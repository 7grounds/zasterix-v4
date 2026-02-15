# MAS Discussion System - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│                    /manager-alpha/page.tsx                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  - Chat Interface                                         │  │
│  │  - Discussion State Management                            │  │
│  │  - Round Progress Display                                 │  │
│  │  - Agent Response Rendering                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP POST
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                     API Route Handler                            │
│              /api/manager-discussion/route.ts                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Phase Management:                                        │  │
│  │  1. Initiation   → Detect keywords, call Discussion Leader│  │
│  │  2. Confirmation → User confirms, create project          │  │
│  │  3. Discussion   → Turn-taking between agents & user      │  │
│  │  4. Summary      → Generate final summary                 │  │
│  │  5. Complete     → Save and close discussion              │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────┬─────────────────────────────┬───────────────────────────┘
        │                             │
        │ Database                    │ AI API
        │ Operations                  │ Calls
        ↓                             ↓
┌──────────────────┐         ┌────────────────────┐
│   Supabase DB    │         │   Groq AI API      │
│                  │         │                    │
│ Tables:          │         │ Models:            │
│ - projects       │         │ - llama-3.1-8b    │
│ - agent_templates│         │                    │
│ - discussion_logs│         │ System Prompts:    │
│ - universal_history│       │ - Manager Alpha    │
│                  │         │ - Discussion Leader│
│ RLS Policies ✓   │         │ - Manager L3       │
│ Indexes ✓        │         │ - Expert Agents    │
└──────────────────┘         └────────────────────┘
```

## Data Flow

### Phase 1: Initiation
```
User: "I want a discussion about tourism"
    ↓
Manager Alpha (AI):
    - Detects "discussion" keyword
    - Responds: "Calling Discussion Leader..."
    ↓
Discussion Leader (AI):
    - Analyzes topic: "tourism"
    - Selects agents: Manager L3, Hotel Expert, Tourismus Expert
    - Proposes rules: 3 lines, 3 rounds
    - Asks for confirmation
```

### Phase 2: Confirmation
```
User: "ja" or "bestätigt"
    ↓
API Route:
    - Parse agent names from proposal
    - Create project in database:
      {
        name: "Diskussion: tourism",
        type: "discussion",
        status: "active",
        metadata: {
          rules: ["3 Zeilen pro Beitrag", "3 Runden"],
          speaker_order: ["Manager L3", "Hotel Expert", "Tourismus Expert", "user"],
          agents: [...],
          topic: "tourism"
        }
      }
    ↓
Manager L3 (AI):
    - Opens discussion
    - Introduces topic and rules
    - First contribution (max 3 lines)
    ↓
Save to discussion_logs:
    {
      project_id: uuid,
      agent_id: Manager L3 id,
      speaker_name: "Manager L3",
      content: "opening message"
    }
    ↓
Save to universal_history:
    {
      user_id: uuid,
      payload: {
        type: "discussion_start",
        speaker: "Manager L3",
        content: "...",
        round: 1
      }
    }
```

### Phase 3: Discussion (Repeated for 3 rounds)
```
Round 1, Agent 1 (Hotel Expert):
    ↓
AI generates response (context: previous messages)
    ↓
Save to discussion_logs + universal_history
    ↓
Return to User: "nextSpeaker: user"
    ↓
User contributes
    ↓
Save to discussion_logs + universal_history
    ↓
Round 1, Agent 2 (Tourismus Expert):
    ↓
AI generates response
    ↓
Save to logs
    ↓
User contributes
    ↓
[Repeat pattern for all agents]
    ↓
Round 1 complete → Move to Round 2
    ↓
[Repeat for Round 2]
    ↓
[Repeat for Round 3]
    ↓
All rounds complete → Phase 4
```

### Phase 4: Summary
```
Manager L3 (AI):
    - Receives all discussion history
    - Generates summary (max 5 lines)
    - Highlights key points and decisions
    ↓
Update project in database:
    {
      status: "completed",
      metadata: {
        ...existing metadata,
        summary: "...",
        completed_at: timestamp
      }
    }
    ↓
Save summary to discussion_logs
    ↓
Save summary to universal_history
    ↓
Return to User: "Discussion complete"
```

## Agent Hierarchy

```
┌─────────────────────────────────────┐
│         Manager Alpha (L4)           │
│  - Main Coordinator                  │
│  - Discussion Initiator              │
│  - Keyword Detection                 │
└─────────────┬───────────────────────┘
              │
              │ Delegates to
              ↓
┌─────────────────────────────────────┐
│      Discussion Leader (L3)          │
│  - Proposes Configuration            │
│  - Recommends Agents                 │
│  - Defines Rules                     │
└─────────────┬───────────────────────┘
              │
              │ Invites
              ↓
┌─────────────────────────────────────┐
│         Manager L3 (L3)              │
│  - Opens Discussion                  │
│  - Provides Strategic View           │
│  - Generates Summary                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      Expert Agents (L2)              │
│  ┌─────────────────────────────┐   │
│  │  Hotel Expert L2             │   │
│  │  - Hotel operations          │   │
│  │  - B2B hospitality           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Guide Expert L2             │   │
│  │  - Alpine experiences        │   │
│  │  - Authentic guidance        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Tourismus Expert L2         │   │
│  │  - Regional strategy         │   │
│  │  - Demand orchestration      │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Experience Curator BO       │   │
│  │  - Experience design         │   │
│  │  - Offer curation            │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Hotel-Hub-Integrator        │   │
│  │  - Hotel networks            │   │
│  │  - B2B integration           │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│           User (L0)                  │
│  - Initiates discussions             │
│  - Participates in rounds            │
│  - Provides domain context           │
└─────────────────────────────────────┘
```

## Database Schema

### projects
```sql
CREATE TABLE projects (
    id uuid PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id),
    name text NOT NULL,
    type text NOT NULL DEFAULT 'discussion',
    status text NOT NULL DEFAULT 'active',
    metadata jsonb NOT NULL DEFAULT '{}',
    current_discussion_step integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Metadata Structure for Discussion Projects:**
```json
{
  "rules": [
    "Jeder Beitrag maximal 3 Zeilen",
    "3 Runden insgesamt",
    "Nutzer kann nach jedem Agenten kommentieren"
  ],
  "speaker_order": ["manager_l3", "hotel_expert_l2", "tourismus_expert_l2", "user"],
  "agents": ["Manager L3", "Hotel Expert L2", "Tourismus Expert L2"],
  "rounds": 3,
  "topic": "tourism strategy",
  "summary": "Final summary text...",
  "completed_at": "2026-02-15T08:30:00Z"
}
```

### discussion_logs
```sql
CREATE TABLE discussion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES agent_templates(id) ON DELETE SET NULL,
    speaker_name text NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

### universal_history
```sql
-- Existing table, used for discussion entries
-- payload structure:
{
  "type": "discussion_start" | "discussion_turn" | "discussion_summary",
  "project_id": "uuid",
  "speaker": "agent name",
  "content": "message text",
  "round": 1,
  "timestamp": "ISO string"
}
```

### agent_templates
```sql
-- Existing table, now includes:
-- - Manager Alpha (L4)
-- - Discussion Leader (L3)
-- - Manager L3 (L3)
-- - Expert Agents (L2)
```

## API Contract

### POST /api/manager-discussion

#### Request Body Types

**Phase: Initiation**
```typescript
{
  message: string;           // User's message
  history?: Message[];       // Conversation history
  userId?: string;
  organizationId?: string;
  phase: "initiation";
}
```

**Phase: Confirmation**
```typescript
{
  message: string;           // "ja" or "bestätigt"
  userId?: string;
  organizationId?: string;
  phase: "confirmation";
  discussionConfig: {
    agents: string[];        // ["Manager L3", "Hotel Expert L2", ...]
    linesPerAgent: number;   // 3
    rounds: number;          // 3
    topic: string;           // "tourism strategy"
  };
}
```

**Phase: Discussion**
```typescript
{
  message: string;           // User's contribution
  userId?: string;
  organizationId?: string;
  phase: "discussion";
  projectId: string;
  discussionConfig: DiscussionConfig;
  currentRound: number;
  currentAgentIndex: number;
}
```

**Phase: Summary**
```typescript
{
  message: string;
  userId?: string;
  organizationId?: string;
  phase: "summary";
  projectId: string;
}
```

#### Response Types

**Phase: Confirmation**
```typescript
{
  phase: "confirmation";
  managerResponse: string;
  leaderResponse: string;
  speaker: "Discussion Leader";
  needsConfirmation: true;
}
```

**Phase: Discussion**
```typescript
{
  phase: "discussion";
  projectId: string;
  response: string;
  speaker: string;
  currentRound: number;
  currentAgentIndex: number;
  discussionConfig: DiscussionConfig;
  nextSpeaker: "user" | string;
  roundComplete?: boolean;
}
```

**Phase: Complete**
```typescript
{
  phase: "complete";
  projectId: string;
  summary: string;
  speaker: "Manager L3";
  message: "Diskussion abgeschlossen...";
}
```

## State Machine

```
┌─────────┐
│  IDLE   │
└────┬────┘
     │
     │ User mentions "discussion"
     ↓
┌─────────────┐
│ INITIATION  │ ← Manager Alpha detects keyword
└─────┬───────┘   Discussion Leader proposes config
      │
      │ User confirms
      ↓
┌─────────────┐
│CONFIRMATION │ ← Create project, start with Manager L3
└─────┬───────┘
      │
      │ Discussion begins
      ↓
┌─────────────┐
│ DISCUSSION  │ ← Agent → User → Agent → User (repeat)
└─────┬───────┘   Track rounds and agent index
      │
      │ All rounds complete
      ↓
┌─────────────┐
│  SUMMARY    │ ← Manager L3 generates summary
└─────┬───────┘
      │
      │ Summary saved
      ↓
┌─────────────┐
│  COMPLETE   │ ← Discussion closed
└─────────────┘
      │
      │ New discussion can start
      ↓
┌─────────┐
│  IDLE   │
└─────────┘
```

## Error Handling

### Agent Not Found
- Check: `agent_templates` table has the required agents
- Solution: Run migration `20260215080000_discussion_leader_agent.sql`

### GROQ_API_KEY Missing
- Check: `.env` file has `GROQ_API_KEY=your_key`
- Solution: Add valid Groq API key

### Project Creation Failed
- Check: User has proper permissions
- Check: `projects` table exists
- Solution: Verify RLS policies allow INSERT

### Discussion Logs Not Saving
- Check: `discussion_logs` table exists
- Solution: Run migration `20260215081000_discussion_logs_table.sql`

### Round/Agent Index Out of Sync
- Cause: Multiple concurrent requests
- Prevention: UI should disable input while processing
- Recovery: System will self-correct on next turn

## Security Considerations

### Row Level Security (RLS)
- ✅ discussion_logs has RLS enabled
- ✅ Users can only read logs from their organization's projects
- ✅ Authenticated users can insert logs
- ✅ Projects table already has RLS

### Input Validation
- Message content trimmed
- Agent names validated against database
- Round/index bounds checked
- projectId validated exists

### Rate Limiting
- Consider implementing rate limits on API route
- Groq API has its own rate limits

### Data Privacy
- Discussion logs contain user and AI messages
- Ensure compliance with data protection regulations
- Consider anonymization options for sensitive topics

## Performance Optimization

### Database Indexes
```sql
-- discussion_logs
CREATE INDEX idx_discussion_logs_project_id ON discussion_logs(project_id);
CREATE INDEX idx_discussion_logs_created_at ON discussion_logs(created_at);
CREATE INDEX idx_discussion_logs_project_created ON discussion_logs(project_id, created_at);
```

### Query Optimization
- Limit history context to last 5-8 messages
- Use `maybeSingle()` instead of `select().limit(1)`
- Batch insert operations when possible

### AI API Optimization
- Cache agent system prompts
- Reuse AI factory instances
- Implement retry logic with exponential backoff
- Consider streaming responses for better UX

### Client-Side Optimization
- Debounce user input
- Implement optimistic UI updates
- Use React.memo for message components
- Virtual scrolling for long discussions

## Monitoring & Logging

### Metrics to Track
- Discussion initiation rate
- Average discussion duration
- Agent response times
- User participation rate
- Completion rate
- Error rates by phase

### Logs to Capture
- Phase transitions
- Agent selection decisions
- AI API call duration
- Database operation timing
- User actions (initiate, confirm, contribute)

### Debug Information
```typescript
console.log('Discussion State:', {
  phase: discussionState.phase,
  projectId: discussionState.projectId,
  round: discussionState.currentRound,
  agentIndex: discussionState.currentAgentIndex,
  nextSpeaker: discussionState.nextSpeaker
});
```

## Future Enhancements

### Planned Features
1. **Custom Configuration**
   - User-defined line limits
   - Adjustable round count
   - Custom agent selection

2. **Rich Media Support**
   - Image attachments
   - Document references
   - Link sharing

3. **Real-time Collaboration**
   - WebSocket integration
   - Multiple users in same discussion
   - Live typing indicators

4. **Analytics Dashboard**
   - Discussion metrics
   - Agent performance
   - Topic trends
   - Participation patterns

5. **Export & Sharing**
   - PDF transcript generation
   - Email summaries
   - Shareable links
   - API for external integration

6. **Advanced AI Features**
   - Sentiment analysis
   - Action item extraction
   - Follow-up suggestions
   - Multi-language support

7. **Workflow Integration**
   - Task creation from decisions
   - Calendar event scheduling
   - Email notifications
   - Slack/Teams integration
