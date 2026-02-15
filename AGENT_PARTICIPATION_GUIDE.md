# Agent Participation Guide

Complete guide to how agents participate in multi-agent discussions in the Zasterix system.

## Overview

The Zasterix Multi-Agent System (MAS) enables structured discussions where multiple AI agents collaborate to solve problems, make decisions, and provide comprehensive analysis.

---

## How Agent Participation Works

### Complete Flow

```
1. User Request
   "I want a discussion about tourism strategy"
   ↓
2. Manager Alpha
   Recognizes "discussion" keyword
   Calls Discussion Leader
   ↓
3. Discussion Leader
   Proposes configuration:
   - Agents: Manager L3, Hotel Expert, Tourism Expert, Guide Expert
   - Rules: 3 lines per agent, 3 rounds
   - Topic: Tourism strategy
   ↓
4. User Confirmation
   User types "ja" or "yes" to confirm
   ↓
5. Manager L3
   Opens discussion with topic introduction
   ↓
6. [AUTO-TRIGGER] Hotel Expert L2
   Responds automatically after 1 second
   ↓
7. [USER CAN INTERJECT]
   User can type response or say "continue"
   ↓
8. [AUTO-TRIGGER] Tourism Expert L2
   Responds automatically
   ↓
9. [AUTO-TRIGGER] Guide Expert L2
   Responds automatically
   ↓
10. Round 2 begins (repeat agents)
    ↓
11. Round 3 begins (repeat agents)
    ↓
12. Manager L3 Summary
    Generates comprehensive summary
    ↓
13. Data Saved
    - Projects table: summary, metadata
    - Discussion_logs: all messages
    - Universal_history: full audit trail
```

---

## State Management

### Discussion State Object

```typescript
type DiscussionState = {
  phase: "normal" | "initiation" | "confirmation" | "discussion" | "summary" | "complete";
  projectId?: string;
  currentRound?: number;
  currentAgentIndex?: number;
  needsConfirmation?: boolean;
  discussionConfig?: {
    agents: string[];
    linesPerAgent: number;
    rounds: number;
    topic: string;
  };
};
```

### State Transitions

```
phase: "normal" 
  → User mentions "discussion"
  
phase: "initiation"
  → Discussion Leader proposes config
  
phase: "confirmation"
  → Waiting for user "ja/yes"
  
phase: "discussion"
  → Agents taking turns
  → currentAgentIndex: 0, 1, 2, 3...
  → currentRound: 1, 2, 3
  
phase: "summary"
  → Manager L3 generates summary
  
phase: "complete"
  → Discussion finished
```

---

## How Agents Are Called

### Agent Calling Function

```typescript
async function callAgent(
  agentName: string,
  systemPrompt: string,
  discussionContext: string,
  maxLines: number = 3
): Promise<string> {
  // 1. Build full prompt with context
  const fullPrompt = `${systemPrompt}

Discussion Context:
${discussionContext}

Instructions:
- Provide your expert perspective on this topic
- Keep response to maximum ${maxLines} lines
- Be specific and actionable
- Build on previous contributions

Your response:`;

  // 2. Call AI API (Groq or Claude)
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: discussionContext }
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Sequential Agent Calling

```typescript
// In API route: /app/api/manager-discussion/route.ts

// Get current agent
const currentAgent = discussionConfig.agents[currentAgentIndex];

// Fetch agent template
const { data: agentTemplate } = await supabase
  .from('agent_templates')
  .select('id, system_prompt')
  .eq('name', currentAgent)
  .eq('organization_id', organizationId)
  .single();

// Build context from previous messages
const context = buildDiscussionContext(discussionLogs, topic);

// Call agent
const agentResponse = await callAgent(
  currentAgent,
  agentTemplate.system_prompt,
  context,
  linesPerAgent
);

// Save response
await saveToDiscussionLog(projectId, agentTemplate.id, currentAgent, agentResponse);

// Update index for next agent
currentAgentIndex = (currentAgentIndex + 1) % agents.length;

// Check if round completed
if (currentAgentIndex === 0) {
  currentRound++;
}
```

---

## Auto-Trigger Mechanism

### Frontend Auto-Trigger

```typescript
// In main-dashboard/page.tsx

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Send message to API
  const response = await fetch('/api/manager-discussion', {
    method: 'POST',
    body: JSON.stringify({
      message: input,
      phase: discussionState.phase,
      projectId: discussionState.projectId,
      currentRound: discussionState.currentRound,
      currentAgentIndex: discussionState.currentAgentIndex,
      discussionConfig: discussionState.discussionConfig,
      // ...
    }),
  });

  const data = await response.json();

  // Update state
  setDiscussionState({
    phase: data.phase,
    projectId: data.projectId,
    currentRound: data.currentRound,
    currentAgentIndex: data.currentAgentIndex,
    discussionConfig: data.discussionConfig,
  });

  // AUTO-TRIGGER: If next speaker is an agent, call automatically
  if (data.phase === "discussion" && data.nextSpeaker && data.nextSpeaker !== "user") {
    setTimeout(async () => {
      setIsLoading(true);
      
      // Automatically trigger next agent
      const nextResponse = await fetch('/api/manager-discussion', {
        method: 'POST',
        body: JSON.stringify({
          message: "continue", // Special keyword
          phase: data.phase,
          projectId: data.projectId,
          currentRound: data.currentRound,
          currentAgentIndex: data.currentAgentIndex,
          discussionConfig: data.discussionConfig,
          // ...
        }),
      });

      const nextData = await nextResponse.json();
      
      // Add agent's response to messages
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: nextData.response,
        speaker: nextData.speaker
      }]);

      // Continue chain if more agents
      if (nextData.nextSpeaker && nextData.nextSpeaker !== "user") {
        // Will trigger again after this render
      }
      
      setIsLoading(false);
    }, 1000); // 1 second delay for UX
  }
};
```

---

## Building Discussion Context

### Context Builder Function

```typescript
function buildDiscussionContext(
  discussionLogs: Array<{speaker_name: string, content: string}>,
  topic: string
): string {
  let context = `Topic: ${topic}\n\nPrevious Discussion:\n\n`;
  
  for (const log of discussionLogs) {
    context += `${log.speaker_name}: ${log.content}\n\n`;
  }
  
  return context;
}
```

This provides each agent with:
- The discussion topic
- All previous contributions
- Who said what
- The flow of conversation

---

## Data Storage

### Discussion Logs Table

```typescript
async function saveToDiscussionLog(
  projectId: string,
  agentId: string,
  speakerName: string,
  content: string
) {
  await supabase.from('discussion_logs').insert({
    project_id: projectId,
    agent_id: agentId,
    speaker_name: speakerName,
    content: content,
    created_at: new Date().toISOString(),
  });
}
```

### Universal History Table

```typescript
async function saveToUniversalHistory(
  userId: string,
  organizationId: string | null,
  projectId: string,
  payload: object
) {
  await supabase.from('universal_history').insert({
    user_id: userId,
    organization_id: organizationId,
    payload: {
      project_id: projectId,
      ...payload
    },
    created_at: new Date().toISOString(),
  });
}
```

### Projects Table

```typescript
// Update project with summary
async function updateProjectSummary(
  projectId: string,
  summary: string
) {
  const { data: project } = await supabase
    .from('projects')
    .select('metadata')
    .eq('id', projectId)
    .single();

  await supabase
    .from('projects')
    .update({
      status: 'completed',
      metadata: {
        ...project.metadata,
        summary: summary
      }
    })
    .eq('id', projectId);
}
```

---

## Troubleshooting

### Agents Not Responding

**Symptom**: After Manager L3 opens discussion, no other agents respond.

**Causes:**
1. Auto-trigger not firing
2. discussionState not being updated
3. API keys missing (GROQ_API_KEY or ANTHROPIC_API_KEY)
4. Phase not set to "discussion"

**Solution:**
```typescript
// Check if auto-trigger condition is met
console.log("Phase:", data.phase);
console.log("Next speaker:", data.nextSpeaker);
console.log("Should trigger:", data.phase === "discussion" && data.nextSpeaker !== "user");

// Verify state is updated
console.log("Discussion state:", discussionState);

// Check API keys
console.log("Groq key exists:", !!process.env.GROQ_API_KEY);
console.log("Anthropic key exists:", !!process.env.ANTHROPIC_API_KEY);
```

### Wrong Agent Speaking

**Symptom**: Hotel Expert speaks when Tourism Expert should.

**Causes:**
1. currentAgentIndex not matching correct index
2. Agents array order wrong
3. Index not incrementing

**Solution:**
```typescript
// Log agent selection
const currentAgent = discussionConfig.agents[currentAgentIndex];
console.log(`Agent at index ${currentAgentIndex}:`, currentAgent);
console.log("Full agents array:", discussionConfig.agents);

// Verify incrementing
const nextIndex = (currentAgentIndex + 1) % agents.length;
console.log("Next index will be:", nextIndex);
```

### Discussion Stops After One Round

**Symptom**: Agents speak once, then discussion ends.

**Causes:**
1. currentRound not incrementing
2. Round check logic wrong
3. Phase transitioning too early to "summary"

**Solution:**
```typescript
// Log round progression
console.log("Current round:", currentRound);
console.log("Current agent index:", currentAgentIndex);

// Check if round should increment
if (currentAgentIndex === 0 && currentRound < 3) {
  console.log("Moving to round", currentRound + 1);
  currentRound++;
}

// Verify phase
console.log("Current phase:", phase);
console.log("Should continue:", currentRound <= 3);
```

### Missing Context

**Symptom**: Agents don't reference previous discussion.

**Causes:**
1. Context not being built correctly
2. Discussion logs not fetched
3. Context too long (truncated)

**Solution:**
```typescript
// Fetch all discussion logs
const { data: logs } = await supabase
  .from('discussion_logs')
  .select('*')
  .eq('project_id', projectId)
  .order('created_at', { ascending: true });

console.log("Discussion logs count:", logs?.length);

// Build and log context
const context = buildDiscussionContext(logs, topic);
console.log("Context length:", context.length);
console.log("Context preview:", context.substring(0, 200));
```

---

## Best Practices

### For Agent System Prompts

```
✅ DO:
- Keep focused on agent's expertise
- Include clear role definition
- Mention 3-line limit
- Encourage building on others' input

❌ DON'T:
- Make prompts too long (over 500 chars)
- Include contradictory instructions
- Forget to mention discussion context
```

### For Discussion Configuration

```
✅ DO:
- Choose relevant agents for the topic
- Keep agent count manageable (3-5 agents)
- Set realistic line limits (3 lines)
- Plan for 3 rounds maximum

❌ DON'T:
- Add too many agents (slows discussion)
- Allow unlimited lines (loses focus)
- Plan too many rounds (user fatigue)
```

### For State Management

```
✅ DO:
- Always pass complete discussionState
- Update state after every API call
- Validate state before using
- Log state changes for debugging

❌ DON'T:
- Assume state persists without passing
- Modify state without updating backend
- Skip validation checks
- Ignore state inconsistencies
```

---

## API Contract

### Request Format

```typescript
POST /api/manager-discussion
{
  message: string,
  history?: Message[],
  userId?: string,
  organizationId?: string,
  phase?: "initiation" | "confirmation" | "discussion" | "summary",
  discussionConfig?: {
    agents: string[],
    linesPerAgent: number,
    rounds: number,
    topic: string
  },
  currentRound?: number,
  currentAgentIndex?: number,
  projectId?: string
}
```

### Response Format

```typescript
{
  response: string,
  speaker?: string,
  phase?: string,
  projectId?: string,
  currentRound?: number,
  currentAgentIndex?: number,
  nextSpeaker?: string,
  discussionConfig?: {
    agents: string[],
    linesPerAgent: number,
    rounds: number,
    topic: string
  },
  needsConfirmation?: boolean
}
```

---

## Summary

The agent participation system works by:

1. **State Management**: Tracking phase, round, agent index, and configuration
2. **Auto-Triggering**: Automatically calling next agent without user input
3. **Context Building**: Providing each agent with full discussion history
4. **Sequential Turns**: Agents speak in order defined in configuration
5. **Data Persistence**: All messages saved to discussion_logs and universal_history

The system is:
- ✅ **Working**: Currently functional with auto-trigger
- ✅ **Flexible**: Different configurations per discussion
- ✅ **Minimal**: No new tables needed
- ✅ **Auditable**: Full history in universal_history
- ✅ **User-Controlled**: User can interject at any time

For additional help, see:
- `.github/copilot-instructions.md` - Copilot guidance
- `DISCUSSION_FLOW_FIX.md` - Technical implementation details
- `MAS_TESTING_GUIDE.md` - Testing procedures
