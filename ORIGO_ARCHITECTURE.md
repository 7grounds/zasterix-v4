# Origo Architecture - System Documentation

## Overview

The **Origo Architecture** is a minimalist, data-centric approach to building the Zasterix multi-agent system. It emphasizes:

1. **Database as Source of Truth**: All logic flows from the database state
2. **Minimal Code**: Avoid unnecessary abstractions and wrappers
3. **Agent Hierarchy**: Respect the strict Zasterix agent levels
4. **User Confirmation**: All agent actions require explicit approval
5. **Agent Memory**: Keywords accumulate in blueprints for long-term learning
6. **No Table Proliferation**: Use existing JSONB columns for extensibility

---

## Core Principles

### 1. Minimalism

**Problem**: Traditional architectures create layers of abstraction (services, repositories, DTOs, state management) that obscure the actual data flow.

**Solution**: Direct database queries with clean React components.

```typescript
// ❌ BLOATED: Multiple layers
class AgentService {
  constructor(private repo: AgentRepository) {}
  async getAgents() {
    const entities = await this.repo.findAll();
    return entities.map(e => this.toDTO(e));
  }
}

// ✅ MINIMAL: Direct access
const { data: agents } = await supabase
  .from('agent_templates')
  .select('*');
```

### 2. Data-Centricity

**Problem**: Application code often duplicates logic that belongs in the database.

**Solution**: Use database features (triggers, RLS, JSONB) to encode business rules.

```typescript
// ❌ APPLICATION LOGIC: Validation in code
if (user.organizationId !== agent.organizationId) {
  throw new Error('Unauthorized');
}

// ✅ DATABASE LOGIC: RLS policy
CREATE POLICY agent_access ON agent_templates
FOR SELECT USING (
  organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
```

### 3. Agent Hierarchy

The Zasterix system has a strict hierarchy that must be respected:

```
Level 4: Architect
  └─ Manager Alpha (Coordinator)

Level 3: Strategic
  ├─ Discussion Leader (Moderator)
  └─ Manager L3 (Decision maker, Summarizer)

Level 2: Tactical
  ├─ Hotel Expert L2 (B2B Hospitality)
  ├─ Guide Expert L2 (Alpine Experiences)
  ├─ Tourismus Expert L2 (Destination Strategy)
  ├─ Experience Curator BO (L2)
  └─ Hotel-Hub-Integrator (L2)

Level 1: Specialists (Future)
  └─ Domain-specific experts
```

**Rules:**
- Higher levels can delegate to lower levels
- Lower levels report to higher levels
- Same-level agents collaborate as peers
- Manager Alpha is the entry point for users

### 4. User Confirmation

**Problem**: Autonomous agents can make unwanted changes.

**Solution**: Two-phase commit pattern - propose, confirm, execute.

```typescript
// Phase 1: Agent proposes
await supabase.from('universal_history').insert({
  payload: {
    type: 'proposed_task',
    status: 'pending_approval',
    agent: 'Code Improvement Agent',
    action: 'refactor_api_route',
    files: ['/app/api/tasks/route.ts'],
    preview: '...'
  }
});

// Phase 2: User confirms
// UI shows preview and requests approval

// Phase 3: Execute only if confirmed
if (userConfirmed) {
  await executeTask(taskId);
  await updateStatus(taskId, 'completed');
}
```

### 5. Agent Memory via Keywords

**Problem**: Agents forget context between sessions.

**Solution**: Store keywords from discussions in `agent_blueprints.logic_template`.

```typescript
// After discussion completes
const keywords = extractKeywords(discussionLogs);
// ['winter-tourism', 'b2b-hotels', 'alpine-authenticity']

await supabase.rpc('update_agent_blueprint_differentiation_keywords', {
  p_keywords: keywords,
  p_blueprint_id: agentBlueprintId
});

// Next time agent is invoked, keywords inform its responses
const blueprint = await supabase
  .from('agent_blueprints')
  .select('logic_template')
  .eq('id', blueprintId)
  .single();

const contextKeywords = blueprint.logic_template.differentiation_keywords;
// Agent prompt includes: "Focus on: winter-tourism, b2b-hotels, alpine-authenticity"
```

### 6. No Table Proliferation

**Problem**: Every feature creates new tables, making schema unwieldy.

**Solution**: Use JSONB columns for extensibility.

```typescript
// ❌ NEW TABLE: Requires migration, indexes, RLS
CREATE TABLE agent_tasks (
  id uuid PRIMARY KEY,
  agent_id uuid REFERENCES agent_templates(id),
  description text,
  status text,
  ...
);

// ✅ USE EXISTING: Flexible payload
INSERT INTO universal_history (user_id, payload) VALUES (
  $1,
  jsonb_build_object(
    'type', 'agent_task',
    'agent_id', $2,
    'description', $3,
    'status', 'pending'
  )
);
```

---

## System Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                         USER                            │
│  (Initiates discussions, confirms tasks)                │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   Manager Alpha (L4)                    │
│  • Entry point for user interactions                    │
│  • Recognizes discussion/meeting requests               │
│  • Delegates to Discussion Leader                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                Discussion Leader (L3)                   │
│  • Proposes discussion configuration                    │
│  • Selects relevant L2 agents                          │
│  • Moderates turn-taking                               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   Manager L3 (L3)                       │
│  • Opens discussions                                    │
│  • Provides strategic guidance                         │
│  • Generates summaries                                 │
│  • EXTRACTS TASKS from discussions                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│              Specialist Agents (L2)                     │
│  • Hotel Expert L2 → Hospitality insights              │
│  • Guide Expert L2 → Alpine experiences                │
│  • Tourismus Expert L2 → Destination strategy          │
│  • Experience Curator → Experience design              │
│  • Hotel-Hub-Integrator → B2B integration             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                DATABASE (Supabase)                      │
│  • agent_templates → Agent definitions                  │
│  • agent_blueprints → Reusable patterns + KEYWORDS     │
│  • projects → Discussion projects                       │
│  • discussion_logs → Conversation history               │
│  • universal_history → All events and tasks            │
└─────────────────────────────────────────────────────────┘
```

### Task Extraction Workflow

```
1. User has discussion with Manager Alpha about "improving code quality"
   ↓
2. Discussion Leader coordinates multi-agent discussion
   ↓
3. Specialists contribute their expertise
   ↓
4. Manager L3 generates summary + EXTRACTS ACTION ITEMS
   │
   ├─ "Refactor API routes for consistency"
   ├─ "Add TypeScript types to all components"
   └─ "Implement error boundaries"
   ↓
5. Tasks stored in universal_history with status: 'pending_approval'
   ↓
6. UI shows tasks to user with preview of changes
   ↓
7. User confirms or rejects each task
   ↓
8. Code Improvement Agent executes ONLY confirmed tasks
   ↓
9. Agent reports back with results
   ↓
10. Keywords from discussion added to agent_blueprints memory
```

---

## Database Schema Details

### agent_blueprints (Agent Memory Storage)

```sql
CREATE TABLE agent_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logic_template jsonb NOT NULL DEFAULT '{}', -- ⭐ KEY FIELD
  ai_model_config jsonb NOT NULL DEFAULT '{"provider":"groq","model":"llama-3.1-8b-instant"}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- logic_template structure:
{
  "pedagogical_rules": "Focus on practical implementation...",
  "differentiation_keywords": [  -- ⭐ AGENT MEMORY
    "winter-tourism",
    "b2b-hospitality",
    "alpine-authenticity",
    "destination-positioning"
  ],
  "domain": "tourism",
  "context_window": 5  -- How many past discussions to reference
}
```

**RPC for updating keywords:**
```sql
CREATE OR REPLACE FUNCTION update_agent_blueprint_differentiation_keywords(
    p_keywords jsonb,
    p_blueprint_id uuid
)
RETURNS void AS $$
BEGIN
    UPDATE agent_blueprints
    SET logic_template = jsonb_set(
        COALESCE(logic_template, '{}'),
        '{differentiation_keywords}',
        COALESCE(p_keywords, '[]'),
        true
    )
    WHERE id = p_blueprint_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### universal_history (Event Store)

```sql
CREATE TABLE universal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  organization_id uuid REFERENCES organizations(id),
  payload jsonb NOT NULL,  -- ⭐ FLEXIBLE EVENT DATA
  summary_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Example payloads:

-- Task proposal
{
  "type": "proposed_task",
  "status": "pending_approval",
  "agent": "Code Improvement Agent",
  "discussion_id": "uuid",
  "description": "Refactor API routes",
  "estimated_impact": "medium",
  "files_affected": ["/app/api/tasks/route.ts"],
  "preview_diff": "..."
}

-- Task execution
{
  "type": "task_execution",
  "status": "completed",
  "task_id": "uuid",
  "agent": "Code Improvement Agent",
  "files_modified": ["/app/api/tasks/route.ts"],
  "lines_changed": 45,
  "result": "success"
}

-- Discussion turn
{
  "type": "discussion_turn",
  "speaker": "Hotel Expert L2",
  "content": "...",
  "round": 2,
  "keywords": ["b2b-hospitality", "occupancy-yield"]
}
```

---

## Implementation Guidelines

### Task Extraction from Discussions

**Minimal implementation using pattern matching:**

```typescript
/**
 * Extract action items from discussion logs.
 * Uses simple pattern matching - no external NLP libraries.
 * Follows Origo Architecture: minimal, data-centric.
 */
export async function extractTasksFromDiscussion(
  discussionId: string,
  supabase: SupabaseClient
): Promise<Array<{description: string, priority: string}>> {
  
  // 1. Fetch discussion logs
  const { data: logs } = await supabase
    .from('discussion_logs')
    .select('content, speaker_name, created_at')
    .eq('project_id', discussionId)
    .order('created_at');
  
  if (!logs) return [];
  
  // 2. Simple pattern matching for action verbs
  const actionPatterns = [
    /\b(create|build|implement|add|develop)\s+([^.!?]+)/gi,
    /\b(refactor|improve|optimize|enhance)\s+([^.!?]+)/gi,
    /\b(fix|resolve|address|correct)\s+([^.!?]+)/gi,
    /\b(we should|need to|must)\s+([^.!?]+)/gi,
  ];
  
  const tasks: Array<{description: string, priority: string}> = [];
  
  for (const log of logs) {
    for (const pattern of actionPatterns) {
      const matches = log.content.matchAll(pattern);
      for (const match of matches) {
        tasks.push({
          description: match[0].trim(),
          priority: determinePriority(log.speaker_name, match[0])
        });
      }
    }
  }
  
  return tasks;
}

function determinePriority(speaker: string, content: string): string {
  // Manager L3 tasks are high priority
  if (speaker.includes('Manager L3')) return 'high';
  // Tasks with "urgent" or "critical" are high
  if (/urgent|critical|asap/i.test(content)) return 'high';
  // Default to medium
  return 'medium';
}
```

**Alternative: Single Groq API call for structured extraction:**

```typescript
/**
 * Use Groq to extract structured tasks from discussion.
 * Still minimal - single API call, no complex pipeline.
 */
export async function extractTasksWithGroq(
  discussionId: string,
  supabase: SupabaseClient
): Promise<Array<{description: string, priority: string, assignee: string}>> {
  
  // Fetch discussion content
  const { data: logs } = await supabase
    .from('discussion_logs')
    .select('content, speaker_name')
    .eq('project_id', discussionId);
  
  const transcript = logs
    .map(log => `${log.speaker_name}: ${log.content}`)
    .join('\n');
  
  // Single Groq call
  const prompt = `Extract action items from this discussion. 
Return JSON array with format: [{"description": "...", "priority": "high|medium|low", "assignee": "..."}]

Discussion:
${transcript}

Action items:`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });
  
  const data = await response.json();
  const tasks = JSON.parse(data.choices[0].message.content);
  
  return tasks;
}
```

### Keyword Extraction and Storage

```typescript
/**
 * Extract keywords from discussion and store in agent blueprint.
 * Builds long-term agent memory.
 */
export async function updateAgentMemoryFromDiscussion(
  discussionId: string,
  agentTemplateId: string,
  supabase: SupabaseClient
): Promise<void> {
  
  // 1. Get agent's blueprint
  const { data: agent } = await supabase
    .from('agent_templates')
    .select('parent_template_id')
    .eq('id', agentTemplateId)
    .single();
  
  if (!agent?.parent_template_id) return;
  
  // 2. Fetch discussion logs from this agent
  const { data: logs } = await supabase
    .from('discussion_logs')
    .select('content')
    .eq('project_id', discussionId)
    .eq('agent_id', agentTemplateId);
  
  if (!logs) return;
  
  // 3. Extract keywords (simple frequency analysis)
  const allText = logs.map(log => log.content).join(' ');
  const words = allText.toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 4); // Ignore short words
  
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Top 10 words by frequency
  const topKeywords = Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
  
  // 4. Get existing keywords
  const { data: blueprint } = await supabase
    .from('agent_blueprints')
    .select('logic_template')
    .eq('id', agent.parent_template_id)
    .single();
  
  const existingKeywords = blueprint?.logic_template?.differentiation_keywords || [];
  
  // 5. Merge and deduplicate
  const mergedKeywords = [...new Set([...existingKeywords, ...topKeywords])];
  
  // 6. Update blueprint
  await supabase.rpc('update_agent_blueprint_differentiation_keywords', {
    p_keywords: mergedKeywords,
    p_blueprint_id: agent.parent_template_id
  });
}
```

---

## Code Improvement Agent Design

### Goal
Create an agent that analyzes the codebase and proposes improvements, with user confirmation required before execution.

### Architecture

```
1. User Request
   ↓
2. Code Improvement Agent analyzes codebase
   ↓
3. Agent proposes changes (stored in universal_history)
   ↓
4. UI shows preview with diff
   ↓
5. User confirms/rejects
   ↓
6. If confirmed: Agent executes via Groq + Codespaces
   ↓
7. Agent reports results
   ↓
8. Keywords added to agent memory
```

### Implementation Phases

**Phase 1: Analysis**
```typescript
// Agent scans codebase for issues
async function analyzeCodebase(targetPath: string) {
  // Read files
  // Check for: missing types, inconsistent patterns, security issues
  // Return structured report
}
```

**Phase 2: Proposal**
```typescript
// Generate proposed fixes
async function proposeImprovements(analysisReport: Report) {
  // Use Groq to generate code suggestions
  // Store in universal_history as proposed_task
  // Return task IDs for user review
}
```

**Phase 3: Confirmation UI**
```typescript
// Show diffs and get user approval
function TaskReviewPanel({ tasks }: { tasks: Task[] }) {
  return (
    <div>
      {tasks.map(task => (
        <TaskPreview
          task={task}
          onApprove={() => approveTask(task.id)}
          onReject={() => rejectTask(task.id)}
        />
      ))}
    </div>
  );
}
```

**Phase 4: Execution**
```typescript
// Execute approved tasks
async function executeTask(taskId: string) {
  // Get task details
  // Apply code changes
  // Run tests
  // Report results
}
```

---

## Best Practices Summary

1. **Always check existing schema before suggesting new tables**
2. **Use JSONB for extensibility** (payload, metadata, logic_template)
3. **Store agent memory as keywords** in agent_blueprints
4. **Require user confirmation** for all agent actions
5. **Keep code minimal** - direct database queries, simple React
6. **Follow the hierarchy** - respect agent levels
7. **Make everything auditable** - log to universal_history
8. **Build data-driven** - logic flows from database state

---

## Next Steps

1. ✅ Created Copilot instructions
2. ✅ Documented Origo Architecture
3. ⏭️ Implement keyword extraction from discussions
4. ⏭️ Build task proposal system (using universal_history)
5. ⏭️ Create user confirmation UI
6. ⏭️ Implement Code Improvement Agent
7. ⏭️ Build closed-loop feedback system

**Remember**: Always ask before creating new tables. Use existing JSONB columns for flexibility.
