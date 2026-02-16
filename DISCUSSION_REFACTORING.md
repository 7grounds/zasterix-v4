# Multi-Agent Discussion System Refactoring

## Problem Statement
The discussion system was outputting "blobs" (unstructured text) and failing to save data properly. Agents were not taking turns correctly, and responses were not being persisted to the database in a structured way.

## Root Causes
1. **No turn management**: Agents could speak simultaneously or multiple times in a row
2. **No stop sequences**: LLM calls lacked proper stop tokens, causing agents to continue indefinitely
3. **Improper data structure**: Using `universal_history` for discussion logs without proper structure
4. **Missing state tracking**: No tracking of current turn index or round number

## Solution Overview

### 1. New Database Schema
Created three dedicated tables to manage discussion flow:

#### `discussion_participants`
```sql
- id: uuid (PK)
- project_id: uuid (FK to projects)
- agent_id: uuid (FK to agent_templates, nullable for user)
- role: text ('manager', 'leader', 'user', 'specialist')
- sequence_order: integer (determines speaking order)
- created_at: timestamptz
```
**Purpose**: Defines the order in which participants speak

#### `discussion_state`
```sql
- id: uuid (PK)
- project_id: uuid (unique FK to projects)
- current_turn_index: integer (current position in sequence_order)
- current_round: integer (which round we're in)
- status: text ('active', 'completed', 'paused')
- created_at/updated_at: timestamptz
```
**Purpose**: Tracks the current state of the discussion

#### `discussion_logs`
```sql
- id: uuid (PK)
- project_id: uuid (FK to projects)
- agent_id: uuid (nullable FK to agent_templates)
- role: text (role of the speaker)
- content: text (what was said)
- turn_index: integer (position in sequence when spoken)
- round_number: integer (which round)
- metadata: jsonb
- created_at: timestamptz
```
**Purpose**: Persists all discussion turns with proper structure

### 2. Refactored Discussion Engine

Created `src/core/discussion-engine-v2.ts` with proper turn-taking logic:

#### Key Features:

**Turn-Based Processing**
```typescript
// Get current participant based on turn index
const currentParticipant = participants[state.current_turn_index];

// If user's turn, wait for input
if (currentParticipant.role === "user") {
  break;
}

// Otherwise, get the agent and generate response
const agent = agentsById.get(currentParticipant.agent_id);
const response = await generateAgentResponse({agent, ...});

// Save to discussion_logs
await saveDiscussionLog({
  projectId,
  agentId: agent.id,
  role: currentParticipant.role,
  content: response,
  turnIndex: state.current_turn_index,
  roundNumber: state.current_round,
});

// Increment turn index
nextTurnIndex++;
if (nextTurnIndex >= participants.length) {
  nextTurnIndex = 0;
  nextRound++;
}
```

**Stop Sequences**
```typescript
// Parse from ai_model_config or use defaults
const modelConfig = parseModelConfig(agent.ai_model_config);
const stopSequences = modelConfig?.stop ?? ["[", "\n\n", "Speaker:"];

// Pass to LLM
await generateText({
  model,
  stop: stopSequences,
  // ...
});
```

**Round Management**
- After MAX_DISCUSSION_ROUNDS (3), mark discussion as "completed"
- MAX_TURN_ITERATIONS (20) safety limit prevents infinite loops

### 3. Data Flow

```
User Input → API Route
  ↓
Load participants (ordered by sequence_order)
Load current state (turn_index, round)
  ↓
Save user message to discussion_logs
  ↓
Loop through agent turns:
  - Get agent at current turn_index
  - Generate response with stop sequences
  - Save to discussion_logs
  - Increment turn_index
  - If turn_index >= participants.length:
      * Reset to 0
      * Increment round
  - If back to user or max rounds reached:
      * Stop and wait for user
  ↓
Update discussion_state
  ↓
Return updated state to UI
```

### 4. How This Fixes the "Blob" Issue

**Before:**
- All agents could speak at once
- No structure to responses
- Agents continued indefinitely without stop sequences
- Data saved to generic universal_history

**After:**
- ONE agent speaks at a time based on sequence_order
- Stop sequences prevent runaway generation
- Strict turn_index and round tracking
- Structured data in discussion_logs with turn/round metadata
- Clear separation between user and agent turns

## API Contract

### GET `/api/discussions/[id]`
Returns current discussion state:
```typescript
{
  status: "success",
  project: {...},
  entries: DiscussionEntry[],
  counts: Record<string, number>,
  speakerOrder: string[],
  nextSpeaker: string | null
}
```

### POST `/api/discussions/[id]`
Advances discussion with user message:
```typescript
Request: {
  message: string,
  userId: string,
  organizationId?: string
}

Response: (same as GET)
```

## Migration Steps

1. Run `20260216111500_discussion_tables.sql` - Creates new tables
2. Run `20260216112000_seed_discussion_participants.sql` - Seeds participants for existing project
3. Deploy updated API route and discussion engine
4. UI continues to work without changes (same API contract)

## Configuration

Constants in `discussion-engine-v2.ts`:
```typescript
const MAX_DISCUSSION_ROUNDS = 3;  // Total rounds before completion
const MAX_TURN_ITERATIONS = 20;   // Safety limit for loop
const DEFAULT_STOP_SEQUENCES = ["[", "\n\n", "Speaker:"];
```

## Testing Checklist

- [ ] Create discussion participants in DB
- [ ] Initialize discussion_state
- [ ] User sends message → saved to discussion_logs
- [ ] Agent 1 (manager) responds automatically
- [ ] Agent 2 (specialist) responds automatically
- [ ] Agent 3 (specialist) responds automatically
- [ ] Back to user's turn
- [ ] Repeat for 3 rounds
- [ ] Discussion marked as "completed"
- [ ] No "blob" output - each response is distinct and turn-based

## Rollback Plan

If issues arise:
1. Revert API route to use old `discussion-engine.ts`
2. Old system uses `universal_history` and `projects.current_discussion_step`
3. New tables can remain (no impact on old system)
