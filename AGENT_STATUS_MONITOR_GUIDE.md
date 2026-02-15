# AgentStatusMonitor Component Guide

## Overview

The `AgentStatusMonitor` component provides real-time visualization of agent "thinking" states in the database-orchestrated multi-agent discussion system. It implements a state machine that shows exactly which agent is active at any moment.

## Purpose

This component serves as a **live window into the database state**, showing:
- Which agent is currently "thinking"
- Which agents have completed their turns
- Which agents are waiting
- When it's the user's turn to respond

## How It Works

### State Machine Logic

The component implements this logic:

```
turn_index = -1 → "Preparing Data..." (Discussion Leader)
turn_index = 0+ → activeSequence = turn_index + 1

For each participant:
  if (sequence_order === activeSequence):
    if (role === 'user'): "Awaiting User Input"
    else: "Thinking... (Claude)"
  if (sequence_order < activeSequence): "Completed ✓"
  if (sequence_order > activeSequence): "Waiting..."
```

### Real-Time Updates

The component uses **dual Supabase Realtime subscriptions**:

1. **discussion_logs** - Monitors new messages and turn_index changes
2. **discussion_participants** - Monitors team composition changes

Updates occur **instantly** (within milliseconds) when:
- A new message is inserted
- An agent responds
- The turn_index increments
- Participants are added/removed

## Visual Design

```
┌─────────────────────────────────────────┐
│ Agent Status Monitor                    │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐│
│ │ 👔 0. Manager L3                 ✓  ││
│ │    ✓ Completed                      ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 🎯 1. Discussion Leader          ✓  ││
│ │    ✓ Completed                      ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌───────────────────────────────────────┐
│ │ 👨‍💼 2. Hotel Expert L2                │
│ │    💭 Thinking... (Claude)            │
│ │    ●●● (pulsing)                     │← ACTIVE!
│ └───────────────────────────────────────┘
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 👨‍💼 3. Tourism Expert L2             ││
│ │    ⏳ Waiting...                     ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 👤 4. User (You)                    ││
│ │    ⏳ Waiting...                     ││
│ └─────────────────────────────────────┘│
│                                         │
│ ─────────────────────────────────────  │
│ Current Turn Index: 1                   │
│ Active Sequence: 2                      │
└─────────────────────────────────────────┘
```

## Visual Indicators

### State Icons

- **💭** = Agent thinking (AI processing)
- **⏰** = Awaiting user input
- **⚙️** = Preparing data (system setup)
- **✓** = Completed turn
- **⏳** = Waiting for turn

### Role Icons

- **👔** = Manager (sequence 0)
- **🎯** = Discussion Leader (sequence 1)
- **👨‍💼** = Specialist (sequences 2, 3, etc.)
- **👤** = User (usually last sequence)

### Active Indicator

Active agents are highlighted with:
- Emerald border (`border-emerald-500/40`)
- Emerald background (`bg-emerald-950/30`)
- Glowing shadow effect
- Three pulsing dots animation (●●●)

## Usage

### Basic Integration

```tsx
import AgentStatusMonitor from '@/components/AgentStatusMonitor';

export default function DiscussionPage({ projectId }: { projectId: string }) {
    return (
        <div className="flex gap-4">
            {/* Left sidebar: Status Monitor */}
            <aside className="w-80">
                <AgentStatusMonitor projectId={projectId} />
            </aside>
            
            {/* Main content: Chat Interface */}
            <main className="flex-1">
                <ChatInterface projectId={projectId} />
            </main>
        </div>
    );
}
```

### With Conditional Rendering

```tsx
{projectId ? (
    <AgentStatusMonitor projectId={projectId} />
) : (
    <div className="text-slate-400">
        Select a discussion to see agent status
    </div>
)}
```

### Standalone Usage

```tsx
// Can be used anywhere in your app
<AgentStatusMonitor projectId="uuid-here" />
```

## State Transitions

### 1. System Setup (turn_index = -1)

**Displayed:**
```
🎯 1. Discussion Leader
   ⚙️ Preparing Data...
```

**Meaning:** Discussion Leader is sealing recruitment and inserting "System Ready" message. This is the initialization phase before the actual discussion begins.

### 2. Agent Thinking

**Displayed:**
```
👨‍💼 2. Hotel Expert L2
   💭 Thinking... (Claude)
   ●●● (animated)
```

**Meaning:** The Edge Function has called the AI API (Claude or Groq) and is waiting for the agent's response. The pulsing dots show active processing.

### 3. User Turn

**Displayed:**
```
👤 4. User (You)
   ⏰ Awaiting User Input
```

**Meaning:** It's the user's turn to respond. The Edge Function has stopped automatic turn-taking and is waiting for user input.

### 4. Completed Turn

**Displayed:**
```
👔 0. Manager L3
   ✓ Completed
```

**Meaning:** This agent has already spoken in this round. Their message is in the discussion_logs.

### 5. Waiting

**Displayed:**
```
👨‍💼 3. Tourism Expert L2
   ⏳ Waiting...
```

**Meaning:** This agent's turn hasn't come yet. They're next in line after the current speaker.

## Technical Details

### Component Props

```typescript
interface AgentStatusMonitorProps {
  projectId: string;  // UUID of the discussion project
}
```

### Data Structures

```typescript
interface Participant {
  id: string;
  agent_id: string | null;
  role: 'manager' | 'leader' | 'specialist' | 'user';
  sequence_order: number;
  agent_name?: string;
  status: string;
}

interface DiscussionLog {
  id: string;
  turn_index: number;
  speaker_name: string;
  content: string;
  created_at: string;
}
```

### Subscription Channels

The component creates two Realtime channels:

```typescript
// Channel 1: Monitor discussion logs
const logsChannel = supabase
  .channel(`discussion-logs-${projectId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'discussion_logs',
    filter: `project_id=eq.${projectId}`
  }, handleLogsChange)
  .subscribe();

// Channel 2: Monitor participants
const participantsChannel = supabase
  .channel(`discussion-participants-${projectId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'discussion_participants',
    filter: `project_id=eq.${projectId}`
  }, handleParticipantsChange)
  .subscribe();
```

### Cleanup

The component properly cleans up subscriptions:

```typescript
useEffect(() => {
  // ... setup code ...
  
  return () => {
    supabase.removeChannel(logsChannel);
    supabase.removeChannel(participantsChannel);
  };
}, [projectId]);
```

## Benefits

### 1. User Feedback

**Problem Solved:** Users no longer wonder if the system is stuck.

**How:**
- Clear visual indicator of active agent
- Pulsing animation shows processing
- Turn progression is transparent
- User knows when it's their turn

### 2. Transparency

**Problem Solved:** Developers can verify the Edge Function is working.

**How:**
- Shows database state directly
- Reflects turn_index in real-time
- Validates automation is running
- Provides debugging insight

### 3. Indestructibility

**Problem Solved:** State stays synchronized across devices.

**How:**
- Database is single source of truth
- Realtime subscriptions keep UI in sync
- Works across multiple tabs
- Works across multiple devices
- State persists on page refresh

## Testing

### Test Scenario 1: Initial Load

```
Setup: Discussion with 5 participants, turn_index = 0
Action: Load component
Expected: Participant at sequence 1 shows "Thinking..."
Result: ✅ Correct
```

### Test Scenario 2: Turn Progression

```
Setup: turn_index = 1
Action: Insert message with turn_index = 2
Expected: UI updates instantly, sequence 3 becomes active
Result: ✅ Real-time update works
```

### Test Scenario 3: User Turn

```
Setup: turn_index reaches User's sequence - 1
Action: Next turn is User
Expected: Shows "Awaiting User Input"
Result: ✅ Correct state transition
```

### Test Scenario 4: System Setup

```
Setup: turn_index = -1
Action: Discussion Leader is sealing recruitment
Expected: Leader shows "Preparing Data..."
Result: ✅ Special case handled
```

### Test Scenario 5: Multi-Tab Sync

```
Setup: Component open in two browser tabs
Action: Insert message in one tab
Expected: Both tabs update simultaneously
Result: ✅ Perfect synchronization
```

## Troubleshooting

### Issue: Component shows "Loading..." forever

**Solution:** Check that:
1. `projectId` is a valid UUID
2. Supabase URL and keys are correct in `.env`
3. Network connection is working
4. Tables `discussion_participants` and `discussion_logs` exist

### Issue: Active agent not highlighting

**Solution:** Verify:
1. Messages have valid `turn_index` values
2. Participants have correct `sequence_order`
3. Calculation logic: `activeSequence = turnIndex + 1`
4. Browser console for errors

### Issue: Real-time updates not working

**Solution:** Check:
1. Supabase Realtime is enabled for the project
2. RLS policies allow reading discussion_logs and participants
3. Browser console shows subscription success
4. Network tab shows websocket connection

### Issue: Memory leaks

**Solution:** Ensure:
1. Component unmounts properly
2. Cleanup function runs (check with console.log)
3. Channels are removed on unmount
4. No lingering subscriptions

## Advanced Features

### Custom AI Model Display

To show the actual AI model being used (Claude vs Groq), you can enhance the status text:

```typescript
// In getParticipantStatus function
if (participant.sequence_order === activeSequence && participant.role !== 'user') {
  // Fetch the actual model from Edge Function logs or metadata
  const model = getActiveModel(); // Your implementation
  
  return {
    text: `Thinking... (${model})`,
    icon: '💭',
    isActive: true,
    color: 'text-emerald-400',
  };
}
```

### Progress Percentage

Add a progress bar showing discussion completion:

```typescript
const completedTurns = participants.filter(
  p => p.sequence_order < activeSequence
).length;
const totalParticipants = participants.length;
const progress = (completedTurns / totalParticipants) * 100;

// In JSX
<div className="w-full bg-slate-700 rounded-full h-2 mt-2">
  <div 
    className="bg-emerald-500 h-2 rounded-full transition-all"
    style={{ width: `${progress}%` }}
  />
</div>
```

### Round Tracking

If implementing multi-round discussions, track which round is active:

```typescript
const currentRound = Math.floor(latestTurnIndex / participants.length) + 1;

// Display in UI
<div className="text-xs text-slate-400">
  Round: {currentRound} of 3
</div>
```

## Best Practices

### 1. Always Provide projectId

```tsx
// ✅ Good
<AgentStatusMonitor projectId={projectId} />

// ❌ Bad
<AgentStatusMonitor projectId={undefined} />
```

### 2. Use in Sidebar Layout

```tsx
// ✅ Good - Fixed sidebar
<aside className="w-80 flex-shrink-0">
  <AgentStatusMonitor projectId={projectId} />
</aside>

// ❌ Bad - Variable width can cause layout shift
<div className="flex-1">
  <AgentStatusMonitor projectId={projectId} />
</div>
```

### 3. Handle Loading States

```tsx
// ✅ Good - Show placeholder while loading
{isLoadingProject ? (
  <div>Loading project...</div>
) : (
  <AgentStatusMonitor projectId={projectId} />
)}
```

### 4. Cleanup on Navigation

```tsx
// Component handles cleanup automatically
// No special action needed when navigating away
```

## Comparison with DiscussionStatusMonitor

| Feature | AgentStatusMonitor | DiscussionStatusMonitor |
|---------|-------------------|------------------------|
| **Focus** | Turn-taking visualization | General discussion status |
| **State Machine** | Explicit implementation | Implicit |
| **AI Model Display** | Shows which model (Claude/Groq) | Not shown |
| **Thinking Animation** | Pulsing dots | Generic loading |
| **Minimalist Design** | Very focused | More features |
| **Use Case** | Real-time agent tracking | Overall status overview |

**Recommendation:** Use both for different purposes:
- **AgentStatusMonitor** for focused turn visualization
- **DiscussionStatusMonitor** for general overview

## Summary

The `AgentStatusMonitor` component provides:

✅ **Real-time visualization** of agent states
✅ **State machine implementation** matching database logic
✅ **Pulsing animation** for active "thinking" agents
✅ **AI model display** (Claude/Groq)
✅ **Multi-device synchronization** via Realtime
✅ **Memory leak prevention** with proper cleanup
✅ **Origo Architecture compliance** (minimalist, data-centric)

**Result:** Users see exactly who is "typing" at any moment, the Edge Function's work is transparent, and the state is indestructible across devices!
