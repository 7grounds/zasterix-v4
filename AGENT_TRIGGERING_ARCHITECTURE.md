# Agent Triggering Architecture - Origo Implementation

**Response to Question:** "Which part of my code triggers the response from other agents when the Manager inserts a message?"

---

## TL;DR - Quick Answer

**Your system does NOT use:**
- ❌ Supabase Realtime subscriptions for agent triggering
- ❌ useEffect monitoring message inserts
- ❌ `meeting_hierarchy` table
- ❌ Database triggers

**Your system DOES use:**
- ✅ **Sequential API calls** with frontend auto-triggering
- ✅ **discussionConfig.agents** array for hierarchy (not a table)
- ✅ **setTimeout** to chain agent responses (1 second delays)
- ✅ **State-based turn management** (currentAgentIndex)

---

## How Agent Responses Are Actually Triggered

### Architecture Pattern

```
User Input → API Call (Manager Alpha)
  ↓
Frontend receives response + discussionState
  ↓
[AUTO-TRIGGER] setTimeout (1000ms)
  ↓
API Call (Agent 1) with state
  ↓
Frontend receives response
  ↓
[AUTO-TRIGGER] setTimeout (1000ms)
  ↓
API Call (Agent 2) with state
  ↓
... continues for all agents
  ↓
Summary generated
```

**Key Point:** This is a **frontend-orchestrated sequential API pattern**, not a Realtime subscription pattern.

---

## Code Locations

### 1. Main Dashboard Auto-Trigger

**File:** `/app/main-dashboard/page.tsx`

**Lines 260-277:** Auto-trigger logic after discussion starts

```typescript
// After Manager L3 opens discussion, auto-trigger next agent
if (data.phase === "discussion" && data.nextSpeaker && data.nextSpeaker !== "user") {
  setTimeout(async () => {
    try {
      // Automatically call next agent without user input
      const nextResponse = await fetch("/api/manager-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "continue",
          userId: userId || "anonymous",
          organizationId: organizationId,
          phase: newState.phase,
          discussionConfig: newState.discussionConfig,
          currentRound: newState.currentRound,
          currentAgentIndex: newState.currentAgentIndex,
          projectId: newState.projectId,
        }),
      });
      // ... handle response and potentially trigger next agent
    } catch (error) {
      console.error("Auto-trigger error:", error);
    }
  }, 1000); // 1 second delay
}
```

**Explanation:**
- After receiving a response from Manager L3 that starts the discussion
- Frontend checks if `nextSpeaker !== "user"`
- If so, automatically triggers another API call after 1 second
- This creates a chain reaction where agents respond sequentially

### 2. Chat Page Multi-Round Auto-Trigger

**File:** `/app/chat/page.tsx`

**Lines 92-108:** Multi-round discussion loop

```typescript
// Auto-trigger: ALL invited agents respond automatically (no mention required)
// Simulate 2 rounds of discussion
for (let round = 1; round <= 2; round++) {
  for (const agentName of specialists) {
    const promptMsg = round === 1 
      ? `Contribute to the discussion about: ${input}. Keep it to 3 lines max.`
      : `Add your final thoughts or build on previous contributions. 3 lines max.`;
    
    const specData = await callApi(promptMsg, agentName, chainContext);
    const specMsg: Message = { role: "assistant", text: specData.text, title: specData.title };
    chainContext = [...chainContext, specMsg];
    setMessages(chainContext);
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
```

**Explanation:**
- Fetches available specialists from database dynamically
- Loops through 2 rounds (configurable)
- Each agent responds automatically with 500ms delay
- No need for explicit mentions or triggers

### 3. API Turn Management

**File:** `/app/api/manager-discussion/route.ts`

**Lines 215-344:** Discussion phase logic

```typescript
if (phase === "discussion") {
  // Determine current speaker
  const currentAgentName = discussionConfig.agents[currentAgentIndex];
  
  // Call the agent
  const agentResponse = await callAgent(
    currentAgentName,
    systemPrompt,
    context,
    history
  );
  
  // Increment to next agent
  let nextIndex = currentAgentIndex + 1;
  let nextRound = currentRound;
  
  if (nextIndex >= discussionConfig.agents.length) {
    nextIndex = 0;
    nextRound++;
  }
  
  // Return response with state for next trigger
  return NextResponse.json({
    response: agentResponse,
    speaker: currentAgentName,
    phase: nextRound > discussionConfig.rounds ? "summary" : "discussion",
    currentAgentIndex: nextIndex,
    currentRound: nextRound,
    nextSpeaker: nextIndex === 0 ? "user" : discussionConfig.agents[nextIndex],
    // ... other state
  });
}
```

**Explanation:**
- API determines which agent should speak based on `currentAgentIndex`
- After agent responds, increments index
- Returns `nextSpeaker` to tell frontend who goes next
- Frontend uses this to decide whether to auto-trigger

---

## No meeting_hierarchy Table

### Why There's No Table

The Origo Architecture principle is "No new tables without necessity". 

**Instead of:**
```sql
CREATE TABLE meeting_hierarchy (
  meeting_id UUID,
  parent_agent_id UUID,
  child_agent_id UUID,
  order_position INT
);
```

**We use:**
```typescript
// Stored in projects.metadata JSONB
{
  "discussionConfig": {
    "agents": ["Manager L3", "Hotel Expert L2", "Tourism Expert L2", "Guide Expert L2"],
    "linesPerAgent": 3,
    "rounds": 3,
    "topic": "Tourism Strategy"
  }
}
```

**Benefits:**
- ✅ No new table needed
- ✅ Flexible per-discussion configuration
- ✅ Easy to modify on the fly
- ✅ Follows Origo minimalism
- ✅ Stored in existing `projects` table

---

## No Realtime Subscriptions for Agent Triggering

### Where Realtime IS Used

**File:** `/app/chat/[id]/ChatInterface.tsx`

**Lines 316-339:** Realtime for roadmap updates

```typescript
useEffect(() => {
  if (!supabase) return;

  const channel = supabase
    .channel(`roadmap_updates_${agent.id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "agent_templates",
        filter: `id=eq.${agent.id}`,
      },
      (payload) => {
        const next = payload.new as Record<string, unknown>;
        setAgent((prev) => normalizeAgentUpdate(prev, next));
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, [agent.id, supabase]);
```

**Purpose:** Updates pedagogical agent roadmap in real-time
**NOT for:** Triggering agent responses in discussions

### Where Realtime is NOT Used

❌ **Not monitoring `discussion_logs` inserts**
❌ **Not triggering agents based on message events**
❌ **Not filtering by meeting_hierarchy**

**Why not?**
- Sequential API pattern is simpler
- Frontend maintains full control
- Easier to debug and test
- No need for complex event filtering
- Better error handling

---

## How to Trace Agent Triggering

### Debug Checklist

When an agent should respond but doesn't:

1. **Check discussionState in frontend**
   ```typescript
   console.log("Discussion State:", discussionState);
   // Should show: phase, currentAgentIndex, discussionConfig
   ```

2. **Check API response**
   ```typescript
   const data = await response.json();
   console.log("API Response:", data);
   // Should include: nextSpeaker, currentAgentIndex, phase
   ```

3. **Check auto-trigger condition**
   ```typescript
   console.log("Next Speaker:", data.nextSpeaker);
   console.log("Should Auto-Trigger:", data.nextSpeaker !== "user");
   ```

4. **Check setTimeout execution**
   ```typescript
   if (data.nextSpeaker !== "user") {
     console.log("Setting timeout for auto-trigger...");
     setTimeout(async () => {
       console.log("Auto-trigger executing now!");
       // ... API call
     }, 1000);
   }
   ```

5. **Check agents array**
   ```typescript
   console.log("Agents in config:", discussionConfig.agents);
   console.log("Current index:", currentAgentIndex);
   console.log("Current agent:", discussionConfig.agents[currentAgentIndex]);
   ```

---

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND STATE                                              │
├─────────────────────────────────────────────────────────────┤
│ discussionState = {                                         │
│   phase: "discussion",                                      │
│   projectId: "abc-123",                                     │
│   currentRound: 1,                                          │
│   currentAgentIndex: 1,                                     │
│   discussionConfig: {                                       │
│     agents: ["Manager L3", "Hotel Expert", "Tourism Expert"]│
│     rounds: 3,                                              │
│     linesPerAgent: 3                                        │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ API REQUEST                                                 │
├─────────────────────────────────────────────────────────────┤
│ POST /api/manager-discussion                                │
│ {                                                           │
│   message: "continue",                                      │
│   phase: "discussion",                                      │
│   currentAgentIndex: 1,                                     │
│   currentRound: 1,                                          │
│   discussionConfig: {...}                                   │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ API LOGIC                                                   │
├─────────────────────────────────────────────────────────────┤
│ 1. Extract currentAgentIndex = 1                            │
│ 2. Get agent: agents[1] = "Hotel Expert"                   │
│ 3. Call Groq API with Hotel Expert system prompt           │
│ 4. Save response to discussion_logs                         │
│ 5. Increment index: nextIndex = 2                          │
│ 6. Determine nextSpeaker: agents[2] = "Tourism Expert"     │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ API RESPONSE                                                │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   response: "Hotel Expert's response...",                   │
│   speaker: "Hotel Expert",                                  │
│   phase: "discussion",                                      │
│   currentAgentIndex: 2,                                     │
│   currentRound: 1,                                          │
│   nextSpeaker: "Tourism Expert"                             │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND AUTO-TRIGGER                                       │
├─────────────────────────────────────────────────────────────┤
│ if (nextSpeaker !== "user") {                               │
│   setTimeout(() => {                                        │
│     // Call API again with updated state                    │
│     fetch("/api/manager-discussion", {                      │
│       body: JSON.stringify({                                │
│         phase: "discussion",                                │
│         currentAgentIndex: 2,  // Updated                   │
│         currentRound: 1,                                    │
│         discussionConfig: {...}                             │
│       })                                                    │
│     })                                                      │
│   }, 1000)                                                  │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
                   [REPEAT CYCLE]
```

---

## Summary: Answering Your Question

### Your Question:
> "Which part of my code triggers the response from the other agents in the meeting_hierarchy when Manager inserts a message?"

### Answer:

**Part 1: meeting_hierarchy**
- ❌ No `meeting_hierarchy` table exists
- ✅ Hierarchy is in `discussionConfig.agents` array
- ✅ Stored in `projects.metadata` as JSONB

**Part 2: Agent Triggering**
- ❌ NOT triggered by useEffect monitoring messages
- ❌ NOT triggered by Realtime subscriptions
- ✅ Triggered by **frontend auto-trigger pattern**
- ✅ Uses `setTimeout` (1 second delay) in `/app/main-dashboard/page.tsx` lines 260-277
- ✅ Chains API calls sequentially

**Part 3: The Triggering Code**

**Primary location:** `/app/main-dashboard/page.tsx` lines 260-277

```typescript
if (data.phase === "discussion" && data.nextSpeaker && data.nextSpeaker !== "user") {
  setTimeout(async () => {
    // THIS IS WHERE AGENT RESPONSES ARE TRIGGERED
    const nextResponse = await fetch("/api/manager-discussion", {
      method: "POST",
      body: JSON.stringify({
        message: "continue",
        phase: newState.phase,
        currentAgentIndex: newState.currentAgentIndex,
        discussionConfig: newState.discussionConfig,
        // ... state
      }),
    });
    // ... handle response and repeat
  }, 1000);
}
```

**Secondary location:** `/app/chat/page.tsx` lines 92-108 (different UI)

### Key Insight

Your architecture uses **frontend orchestration** rather than **database event handling**. This is:
- ✅ Simpler to understand and debug
- ✅ Follows Origo minimalism principles
- ✅ Gives frontend full control
- ✅ Easier to test and modify

**No Realtime subscription needed** because the frontend explicitly controls when to call each agent through sequential API calls.

---

## If You Want Realtime Subscriptions

If you wanted to implement a Realtime-based approach (NOT recommended, but possible):

```typescript
// Example (NOT current implementation)
useEffect(() => {
  const channel = supabase
    .channel('discussion_messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'discussion_logs',
        filter: `project_id=eq.${projectId}`
      },
      (payload) => {
        // Would need to:
        // 1. Check if message is from Manager
        // 2. Look up meeting_hierarchy (would need table)
        // 3. Determine next agent
        // 4. Trigger agent response
        // 
        // This is MORE complex than current approach
      }
    )
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}, [projectId]);
```

**Why we DON'T do this:**
- More complex
- Requires meeting_hierarchy table
- Harder to debug
- Less control over timing
- More potential for race conditions

**Current approach is better for Origo Architecture.**

---

## Conclusion

Your system correctly implements agent triggering through:
1. ✅ Frontend-controlled sequential API calls
2. ✅ State-based turn management (currentAgentIndex)
3. ✅ Auto-trigger with setTimeout (1 second delays)
4. ✅ discussionConfig.agents array (not meeting_hierarchy table)

**No bugs found.** The architecture is working as designed.

If agents aren't responding, check:
- ✓ discussionConfig.agents array is populated
- ✓ currentAgentIndex is incrementing
- ✓ API is returning nextSpeaker correctly
- ✓ Auto-trigger setTimeout is executing
- ✓ No JavaScript errors in console

**The code is in `/app/main-dashboard/page.tsx` lines 260-277** - that's your agent trigger mechanism!
