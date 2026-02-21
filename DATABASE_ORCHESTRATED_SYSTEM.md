# Database-Orchestrated Multi-Agent System

## Overview

This document describes the refactored multi-agent discussion system that uses **database-orchestrated flow** instead of frontend setTimeout logic. The system follows Origo Architecture principles with all logic, turn-taking, and recruitment happening via SQL and Edge Functions.

## Architecture

### Core Principle
**Frontend is just a window into the discussion_logs table**. All orchestration happens at the database level, making the system:
- ✅ Indestructible (works even if browser closes)
- ✅ Data-driven (all state in database)
- ✅ Auditable (complete history)
- ✅ Scalable (database handles concurrency)

---

## Components

### 1. Database Tables

#### `discussion_participants`
Tracks who participates in each discussion and their turn order.

```sql
CREATE TABLE discussion_participants (
    id uuid PRIMARY KEY,
    project_id uuid REFERENCES projects(id),
    agent_id uuid REFERENCES agent_templates(id),
    role text CHECK (role IN ('manager', 'leader', 'specialist', 'user')),
    sequence_order integer NOT NULL,  -- Turn order
    status text DEFAULT 'active',
    metadata jsonb,
    UNIQUE (project_id, sequence_order)
);
```

**Sequence Order:**
- 0: Manager L3
- 1: Discussion Leader
- 2: Specialist A
- 3: Specialist B
- 4: User

#### `discussion_logs` (Enhanced)
Now includes `turn_index` for tracking conversation turns.

```sql
ALTER TABLE discussion_logs 
ADD COLUMN turn_index integer DEFAULT 0;
```

**turn_index values:**
- `-1`: System messages (doesn't trigger next turn)
- `0+`: Regular conversation turns (triggers next speaker)

---

### 2. SQL Functions

#### `recruit_specialists_for_discussion(p_project_id, p_project_keywords)`

**Purpose:** Architect logic - finds 2 specialists and recruits all participants.

**Process:**
1. Finds Manager L3 agent
2. Finds Discussion Leader agent
3. Finds 2 Level 2 specialists (based on keywords if provided)
4. Bulk inserts all participants with correct sequence order
5. Returns participant list

**Usage:**
```sql
SELECT * FROM recruit_specialists_for_discussion(
    'project-uuid-here',
    ARRAY['hotel', 'tourism']
);
```

#### `seal_discussion_recruitment(p_project_id, p_user_id, p_organization_id)`

**Purpose:** Discussion Leader logic - verifies participants and signals readiness.

**Process:**
1. Counts active participants
2. Verifies minimum count (Manager + Leader + 1 specialist)
3. Inserts "System Ready" message with `turn_index = -1`
4. Logs to universal_history
5. Returns success/failure

**Usage:**
```sql
SELECT seal_discussion_recruitment(
    'project-uuid-here',
    'user-uuid-here',
    'org-uuid-here'
);
```

**The "System Ready" message is the trigger** that starts the entire conversation flow.

#### `get_next_speaker(p_project_id)`

**Purpose:** Turn Controller - determines next agent to speak.

**Process:**
1. Gets last turn_index from discussion_logs
2. Calculates next sequence_order
3. Returns next speaker info (agent_id, name, system_prompt, is_user)
4. Handles wrap-around for multi-round discussions

**Usage:**
```sql
SELECT * FROM get_next_speaker('project-uuid-here');
```

---

### 3. Edge Function: Turn Controller

**Location:** `supabase/functions/turn-controller/index.ts`

**Trigger:** Webhook on INSERT to `discussion_logs` table

**Process Flow:**
```
1. Webhook triggered by new message in discussion_logs
   ↓
2. Check if turn_index = -1 (system message)
   → If yes: Ignore and return
   → If no: Continue
   ↓
3. Call get_next_speaker() SQL function
   ↓
4. Check if next speaker is user
   → If yes: Wait for user input (return)
   → If no: Continue
   ↓
5. Fetch discussion context (last 10 messages)
   ↓
6. Call AI API (Claude or Groq)
   ↓
7. Insert AI response to discussion_logs with turn_index + 1
   ↓
8. [Webhook triggers again for next turn]
```

**Key Features:**
- ✅ Works even if browser is closed
- ✅ Automatic turn-taking
- ✅ Pauses when user turn arrives
- ✅ Uses Claude (primary) or Groq (fallback)
- ✅ Logs all actions

---

## Discussion Flow

### Phase 1: Manager L3 "Social" Kickoff

**Goal:** Manager greets user and collects project topic.

**Flow:**
```
User → API: "Start discussion"
  ↓
Manager L3: "Hello! What project would you like to discuss?"
  ↓
User → API: "Tourism strategy for winter season"
  ↓
Manager L3: "Great! Let me recruit the team..."
  ↓
[Trigger Architect]
```

### Phase 2: Architect Recruitment

**Goal:** Find and recruit 2 specialists.

**Process:**
```sql
-- API calls this function
SELECT * FROM recruit_specialists_for_discussion(
    project_id,
    ARRAY['tourism', 'winter', 'strategy']
);

-- Function performs bulk insert:
INSERT INTO discussion_participants VALUES
  (project_id, manager_id, 'manager', 0),
  (project_id, leader_id, 'leader', 1),
  (project_id, specialist_1_id, 'specialist', 2),
  (project_id, specialist_2_id, 'specialist', 3),
  (project_id, NULL, 'user', 4);
```

**Result:** All participants registered with sequence order.

### Phase 3: Discussion Leader "Seals" Recruitment

**Goal:** Verify participants and start discussion.

**Process:**
```sql
-- API calls this function
SELECT seal_discussion_recruitment(
    project_id,
    user_id,
    organization_id
);

-- Function inserts:
INSERT INTO discussion_logs (
    project_id,
    agent_id,
    speaker_name,
    content,
    turn_index
) VALUES (
    project_id,
    leader_id,
    'Discussion Leader',
    'System Ready: All participants recruited. Discussion can begin.',
    -1  -- System message, won't trigger turn
);
```

**This message signals the system is ready.**

### Phase 4: Automatic Turn-Taking

**Goal:** Agents speak in sequence automatically.

**Process:**
```
1. User inserts message (turn_index = 0)
   ↓
2. Webhook → Turn Controller Edge Function
   ↓
3. get_next_speaker() → Returns Specialist A (sequence 2)
   ↓
4. Edge Function calls Claude/Groq
   ↓
5. Insert Specialist A response (turn_index = 1)
   ↓
6. Webhook → Turn Controller
   ↓
7. get_next_speaker() → Returns Specialist B (sequence 3)
   ↓
8. Edge Function calls AI
   ↓
9. Insert Specialist B response (turn_index = 2)
   ↓
10. Webhook → Turn Controller
   ↓
11. get_next_speaker() → Returns User (sequence 4)
   ↓
12. Edge Function sees is_user = true → STOPS
   ↓
13. Wait for user input...
```

**This continues until discussion ends.**

---

## Setting Up Webhooks

### Enable Webhooks in Supabase

1. **Go to Supabase Dashboard**
2. **Database → Webhooks**
3. **Create new webhook:**
   ```
   Name: Discussion Turn Controller
   Table: discussion_logs
   Events: INSERT
   Type: HTTP Request
   URL: https://[your-project].supabase.co/functions/v1/turn-controller
   HTTP Headers:
     Authorization: Bearer [anon-key]
   ```

### Deploy Edge Function

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref idsifdlczfhhabqaytma

# Deploy the function
supabase functions deploy turn-controller

# Set secrets
supabase secrets set GROQ_API_KEY=your_key
supabase secrets set ANTHROPIC_API_KEY=your_key
```

---

## API Changes

### Refactored `/api/manager-discussion/route.ts`

**New Flow:**
1. **Greeting Phase**: Manager greets and asks for project topic
2. **Topic Collection**: User provides topic
3. **Recruitment Phase**: Call `recruit_specialists_for_discussion()`
4. **Sealing Phase**: Call `seal_discussion_recruitment()`
5. **Ready**: System is now ready, turn controller takes over

**Frontend becomes read-only:**
- Displays messages from discussion_logs
- Uses Realtime subscriptions to show new messages
- Only allows user input when it's user's turn

---

## Benefits

### vs. Frontend setTimeout Approach

| Feature | Frontend setTimeout | Database-Orchestrated |
|---------|-------------------|----------------------|
| **Reliability** | ❌ Breaks if browser closes | ✅ Continues even if browser closes |
| **State Management** | ❌ Lost on refresh | ✅ Persists in database |
| **Turn Control** | ❌ Frontend logic | ✅ SQL functions |
| **Concurrency** | ❌ Race conditions possible | ✅ Database handles it |
| **Audibility** | ❌ Hard to trace | ✅ Every action logged |
| **Testing** | ❌ Requires UI | ✅ Can test via SQL |
| **Scalability** | ❌ One browser at a time | ✅ Multiple users can follow |

### Origo Architecture Compliance

✅ **Minimalism**: No frontend logic, just database operations
✅ **Data-Centric**: All state in database
✅ **Auditability**: Complete history in universal_history
✅ **Indestructible**: System continues regardless of frontend

---

## Testing

### Test Recruitment

```sql
-- Create test project
INSERT INTO projects (id, name, type, status)
VALUES ('test-uuid', 'Test Discussion', 'discussion', 'active');

-- Recruit specialists
SELECT * FROM recruit_specialists_for_discussion(
    'test-uuid',
    ARRAY['expert']
);

-- Verify participants
SELECT * FROM discussion_participants 
WHERE project_id = 'test-uuid'
ORDER BY sequence_order;

-- Should return 5 rows (Manager, Leader, 2 Specialists, User)
```

### Test Sealing

```sql
-- Seal recruitment
SELECT seal_discussion_recruitment(
    'test-uuid',
    auth.uid(),
    (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Verify system message
SELECT * FROM discussion_logs 
WHERE project_id = 'test-uuid' 
AND turn_index = -1;
```

### Test Turn Controller

```sql
-- Insert user message (turn_index = 0)
INSERT INTO discussion_logs (
    project_id, speaker_name, content, turn_index
) VALUES (
    'test-uuid', 'User', 'Let's discuss tourism', 0
);

-- Watch for automatic responses
SELECT * FROM discussion_logs 
WHERE project_id = 'test-uuid'
ORDER BY created_at DESC;

-- Should see agents responding automatically
```

---

## Troubleshooting

### Agents Not Responding

1. **Check webhook is configured**
   ```
   Supabase Dashboard → Database → Webhooks
   Verify webhook is enabled for discussion_logs INSERT
   ```

2. **Check Edge Function is deployed**
   ```bash
   supabase functions list
   # Should show turn-controller
   ```

3. **Check Edge Function logs**
   ```bash
   supabase functions logs turn-controller
   ```

4. **Verify API keys are set**
   ```bash
   supabase secrets list
   # Should show GROQ_API_KEY and ANTHROPIC_API_KEY
   ```

### turn_index Not Incrementing

Check `get_next_speaker()` function is working:
```sql
SELECT * FROM get_next_speaker('project-uuid');
```

Should return next speaker based on last turn_index.

### UUID Errors

Ensure you're using actual UUIDs, not strings:
```sql
-- ❌ BAD
'project-id-here'

-- ✅ GOOD
'550e8400-e29b-41d4-a716-446655440000'::uuid
```

Use `gen_random_uuid()` or pass actual UUIDs from frontend.

---

## Migration Path

### From Current System

1. ✅ Run migrations (already created)
2. ✅ Deploy Edge Function
3. ✅ Configure webhook
4. ✅ Update API route
5. ✅ Update frontend to use Realtime

### Backward Compatibility

The system can coexist with old frontend-driven approach:
- New discussions use database-orchestrated flow
- Old discussions continue with frontend setTimeout
- Gradually migrate as needed

---

## Summary

The database-orchestrated system provides:
- ✅ Indestructible multi-agent discussions
- ✅ Complete database-driven flow
- ✅ Automatic turn-taking via Edge Functions
- ✅ Proper UUID handling
- ✅ Origo Architecture compliance
- ✅ Works even when browser closes

**Frontend becomes a simple viewer of discussion_logs table with Realtime updates.**
