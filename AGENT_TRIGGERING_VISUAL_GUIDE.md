# Visual Guide: How Agent Responses Are Triggered

Quick visual reference for understanding agent triggering in the Origo Architecture.

---

## The Simple Answer

```
┌──────────────────────────────────────────────────────────────┐
│  WHERE AGENTS ARE TRIGGERED                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  File: /app/main-dashboard/page.tsx                         │
│  Lines: 260-277                                             │
│                                                              │
│  Mechanism: setTimeout auto-trigger                          │
│  Delay: 1000ms (1 second)                                   │
│  Pattern: Frontend-orchestrated API calls                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## What You Asked vs. What It Actually Is

### What You Asked About:

```
❌ Supabase Realtime subscription monitoring messages
❌ useEffect watching for Manager's message inserts
❌ meeting_hierarchy table for agent filtering
❌ Database triggers on message inserts
```

### What It Actually Is:

```
✅ Frontend auto-trigger with setTimeout
✅ discussionConfig.agents array (not table)
✅ Sequential API calls
✅ State-based turn management
```

---

## Visual Flow

```
╔═══════════════════════════════════════════════════════════════╗
║                    USER SENDS MESSAGE                         ║
╚═══════════════════════════════════════════════════════════════╝
                             ↓
┌───────────────────────────────────────────────────────────────┐
│ Frontend: handleSubmit()                                      │
│ File: /app/main-dashboard/page.tsx                           │
│ Action: POST /api/manager-discussion                         │
│ Body: { message, phase, currentAgentIndex, discussionConfig }│
└───────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│ API: manager-discussion/route.ts                             │
│ Logic: Determine current agent from index                     │
│ Action: Call Groq with agent's system prompt                 │
│ Save: Store response in discussion_logs                      │
│ Return: { response, nextSpeaker, currentAgentIndex++ }       │
└───────────────────────────────────────────────────────────────┘
                             ↓
┌───────────────────────────────────────────────────────────────┐
│ Frontend: Receive response                                    │
│ Check: Is nextSpeaker !== "user" ?                          │
│ Action: Update UI with agent response                        │
└───────────────────────────────────────────────────────────────┘
                             ↓
                      ┌──────────────┐
                      │ nextSpeaker  │
                      │ === "user" ? │
                      └──────────────┘
                       ↙           ↘
                    YES             NO
                     ↓               ↓
              ┌──────────┐    ┌────────────────┐
              │ WAIT for │    │ AUTO-TRIGGER   │
              │ user     │    │ setTimeout     │
              │ input    │    │ (1000ms)       │
              └──────────┘    └────────────────┘
                                      ↓
                              ┌───────────────────┐
                              │ Call API again    │
                              │ with updated      │
                              │ currentAgentIndex │
                              └───────────────────┘
                                      ↓
                              [REPEAT FROM TOP]
```

---

## Code Snippet: The Exact Triggering Logic

**Location:** `/app/main-dashboard/page.tsx` Lines 260-277

```typescript
// After receiving API response with agent message
if (data.phase === "discussion" && 
    data.nextSpeaker && 
    data.nextSpeaker !== "user") {
  
  // ⭐ THIS IS WHERE AUTO-TRIGGER HAPPENS ⭐
  setTimeout(async () => {
    try {
      // Call API again to get next agent's response
      const nextResponse = await fetch("/api/manager-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "continue",           // Trigger message
          userId: userId || "anonymous",
          organizationId: organizationId,
          phase: newState.phase,         // Still "discussion"
          discussionConfig: newState.discussionConfig,
          currentRound: newState.currentRound,
          currentAgentIndex: newState.currentAgentIndex, // Incremented
          projectId: newState.projectId,
        }),
      });
      
      // Process response and potentially trigger next agent
      const nextData = await nextResponse.json();
      // ... handle and repeat if nextData.nextSpeaker !== "user"
      
    } catch (error) {
      console.error("Auto-trigger error:", error);
    }
  }, 1000); // ⭐ 1 SECOND DELAY ⭐
}
```

---

## State Management

### discussionConfig Structure

```typescript
{
  "agents": [
    "Manager L3",           // index 0 - opens discussion
    "Hotel Expert L2",      // index 1 - first specialist
    "Tourism Expert L2",    // index 2 - second specialist
    "Guide Expert L2"       // index 3 - third specialist
  ],
  "linesPerAgent": 3,      // max 3 lines per response
  "rounds": 3,             // 3 rounds total
  "topic": "Tourism Strategy"
}
```

### State Tracking

```typescript
{
  "phase": "discussion",
  "currentAgentIndex": 1,    // Currently: Hotel Expert
  "currentRound": 1,         // First round
  "projectId": "abc-123",
  "discussionConfig": { /* above */ }
}
```

### Turn Progression

```
Round 1:
  currentAgentIndex: 0 → Manager L3 opens
  currentAgentIndex: 1 → Hotel Expert responds
  currentAgentIndex: 2 → Tourism Expert responds
  currentAgentIndex: 3 → Guide Expert responds

Round 2:
  currentAgentIndex: 0 → (wraps around, but user input allowed)
  currentAgentIndex: 1 → Hotel Expert responds
  currentAgentIndex: 2 → Tourism Expert responds
  currentAgentIndex: 3 → Guide Expert responds

Round 3:
  currentAgentIndex: 1 → Hotel Expert responds
  currentAgentIndex: 2 → Tourism Expert responds
  currentAgentIndex: 3 → Guide Expert responds
  
Summary:
  currentAgentIndex: 0 → Manager L3 summarizes
```

---

## Why No meeting_hierarchy Table?

### Traditional Approach (NOT Used):

```sql
CREATE TABLE meeting_hierarchy (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id),
  parent_agent_id UUID REFERENCES agents(id),
  child_agent_id UUID REFERENCES agents(id),
  order_position INTEGER,
  can_speak BOOLEAN
);

-- Complex queries needed:
SELECT child_agent_id 
FROM meeting_hierarchy 
WHERE meeting_id = $1 
  AND parent_agent_id = $2 
  AND can_speak = true 
ORDER BY order_position;
```

### Origo Approach (ACTUALLY Used):

```typescript
// Simply stored in projects.metadata JSONB:
{
  "discussionConfig": {
    "agents": ["Manager L3", "Hotel Expert L2", "Tourism Expert L2"]
  }
}

// Simple array access:
const currentAgent = discussionConfig.agents[currentAgentIndex];
```

**Benefits:**
- ✅ No new table (Origo principle: minimize tables)
- ✅ Simpler queries (no JOINs needed)
- ✅ Flexible per-discussion
- ✅ Easy to modify
- ✅ Better performance
- ✅ Clearer code

---

## Why No Realtime Subscriptions?

### If We Used Realtime (NOT Recommended):

```typescript
// Complex event-driven approach:
useEffect(() => {
  const channel = supabase
    .channel('discussion_messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'discussion_logs',
      filter: `project_id=eq.${projectId}`
    }, async (payload) => {
      // Need to:
      // 1. Check if message is from Manager
      // 2. Query meeting_hierarchy for next agent
      // 3. Check if it's this agent's turn
      // 4. Trigger agent response
      // 5. Handle race conditions
      // 6. Deal with multiple clients
      
      // VERY COMPLEX! ❌
    })
    .subscribe();
}, [projectId]);
```

**Problems:**
- ❌ Complex logic
- ❌ Race conditions
- ❌ Hard to debug
- ❌ Requires meeting_hierarchy table
- ❌ Multiple clients could trigger same agent
- ❌ No control over timing
- ❌ Error handling is difficult

### Current Approach (Simple & Better):

```typescript
// Clean sequential approach:
setTimeout(async () => {
  const response = await fetch("/api/manager-discussion", {
    body: JSON.stringify({
      currentAgentIndex: nextIndex,
      // ... state
    })
  });
  // Done! ✅
}, 1000);
```

**Advantages:**
- ✅ Simple and clear
- ✅ No race conditions
- ✅ Easy to debug
- ✅ Full control over timing
- ✅ Clear error handling
- ✅ Works with any number of clients
- ✅ Follows Origo minimalism

---

## Debugging Agent Triggering

### Quick Debug Steps:

```typescript
// 1. Check if discussionConfig is populated
console.log("Agents:", discussionState.discussionConfig?.agents);
// Should show: ["Manager L3", "Hotel Expert L2", ...]

// 2. Check current index
console.log("Current Agent Index:", discussionState.currentAgentIndex);
// Should be a number: 0, 1, 2, 3...

// 3. Check next speaker from API
console.log("Next Speaker:", data.nextSpeaker);
// Should be agent name or "user"

// 4. Check auto-trigger condition
console.log("Will Auto-Trigger:", data.nextSpeaker !== "user");
// Should be true for agents, false for user

// 5. Verify setTimeout is called
if (data.nextSpeaker !== "user") {
  console.log("⭐ AUTO-TRIGGER ACTIVATED ⭐");
  setTimeout(() => {
    console.log("⭐ AUTO-TRIGGER EXECUTING ⭐");
    // ... API call
  }, 1000);
}
```

### Common Issues:

| Issue | Check | Fix |
|-------|-------|-----|
| Agents not responding | discussionConfig.agents array | Ensure array has agent names |
| Same agent repeats | currentAgentIndex not incrementing | Check API response |
| No auto-trigger | nextSpeaker === "user" | API should return agent name |
| JavaScript errors | Browser console | Fix errors blocking setTimeout |
| API errors | Network tab | Check API response status |

---

## Complete Example: 3-Agent Discussion

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User Input                                          │
├─────────────────────────────────────────────────────────────┤
│ Message: "Let's discuss tourism strategy"                  │
│ State: { phase: "initiation", currentAgentIndex: 0 }       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Manager Alpha Responds                             │
├─────────────────────────────────────────────────────────────┤
│ API Response: { speaker: "Manager Alpha", nextSpeaker:     │
│                 "Discussion Leader" }                       │
│ State: { phase: "initiation", currentAgentIndex: 0 }       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Discussion Leader Proposes                         │
├─────────────────────────────────────────────────────────────┤
│ Config: { agents: ["Manager L3", "Hotel Expert",           │
│                     "Tourism Expert", "Guide Expert"],      │
│           rounds: 3, linesPerAgent: 3 }                     │
│ State: { phase: "confirmation", needsConfirmation: true }   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: User Confirms                                       │
├─────────────────────────────────────────────────────────────┤
│ Message: "ja"                                               │
│ State: { phase: "discussion", currentAgentIndex: 0,        │
│          currentRound: 1, discussionConfig: {...} }         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Manager L3 Opens Discussion                        │
├─────────────────────────────────────────────────────────────┤
│ API Response: { speaker: "Manager L3",                     │
│                 nextSpeaker: "Hotel Expert",                │
│                 currentAgentIndex: 1 }                      │
│ ⭐ AUTO-TRIGGER: setTimeout (1000ms) ⭐                     │
└─────────────────────────────────────────────────────────────┘
                        ↓ (1 second)
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Hotel Expert Responds                              │
├─────────────────────────────────────────────────────────────┤
│ API Call: { currentAgentIndex: 1, message: "continue" }    │
│ API Response: { speaker: "Hotel Expert",                   │
│                 nextSpeaker: "Tourism Expert",              │
│                 currentAgentIndex: 2 }                      │
│ ⭐ AUTO-TRIGGER: setTimeout (1000ms) ⭐                     │
└─────────────────────────────────────────────────────────────┘
                        ↓ (1 second)
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Tourism Expert Responds                            │
├─────────────────────────────────────────────────────────────┤
│ API Call: { currentAgentIndex: 2, message: "continue" }    │
│ API Response: { speaker: "Tourism Expert",                 │
│                 nextSpeaker: "Guide Expert",                │
│                 currentAgentIndex: 3 }                      │
│ ⭐ AUTO-TRIGGER: setTimeout (1000ms) ⭐                     │
└─────────────────────────────────────────────────────────────┘
                        ↓ (1 second)
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: Guide Expert Responds                              │
├─────────────────────────────────────────────────────────────┤
│ API Call: { currentAgentIndex: 3, message: "continue" }    │
│ API Response: { speaker: "Guide Expert",                   │
│                 nextSpeaker: "user",  ← ⭐ NOTE!           │
│                 currentAgentIndex: 0,                       │
│                 currentRound: 2 }                           │
│ ⏸️  NO AUTO-TRIGGER (nextSpeaker === "user")               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 9: User Can Respond or Type "continue"                │
├─────────────────────────────────────────────────────────────┤
│ [ROUND 1 COMPLETE - User can participate]                  │
│ Message: "continue" or actual input                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
              [REPEAT FOR ROUNDS 2 & 3]
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 10: Manager L3 Summary                                │
├─────────────────────────────────────────────────────────────┤
│ After Round 3 complete, currentAgentIndex wraps to 0       │
│ Manager L3 generates summary of key decisions              │
│ State: { phase: "summary" }                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

### Your Question:
> "Which part of my code triggers the response from the other agents?"

### Answer:
**File:** `/app/main-dashboard/page.tsx`  
**Lines:** 260-277  
**Mechanism:** `setTimeout` auto-trigger (1000ms delay)  
**Pattern:** Frontend-orchestrated sequential API calls  

### Not Used:
- ❌ Realtime subscriptions
- ❌ useEffect monitoring messages
- ❌ meeting_hierarchy table
- ❌ Database triggers

### Actually Used:
- ✅ Frontend auto-trigger
- ✅ discussionConfig.agents array
- ✅ State-based turn management
- ✅ Sequential API calls

**Architecture:** Clean, simple, and follows Origo principles perfectly! ✅

For detailed documentation, see: `AGENT_TRIGGERING_ARCHITECTURE.md`
