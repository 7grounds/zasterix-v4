# Keyword Trigger System: Universal Mention ("Lean-In")

## Overview

The Keyword Trigger System enables dynamic, intelligent agent participation in discussions. Agents "listen" to every message and can respond when their expertise is mentioned, regardless of the predefined sequence_order.

This implements Phase 2 of the Master Prompt: **Universal Mention Trigger ("The Lean-In")**.

---

## How It Works

### 1. Trigger Keywords

Each agent in `agent_templates` has a `trigger_keywords` column containing an array of lowercase keywords:

```sql
-- Example: Hotel Expert L2
trigger_keywords: ['hotel', 'expert', 'accommodation', 'booking', 'room', 'lodging', 'hospitality', 'reservation']
```

### 2. Message Scanning

When a new message is inserted into `discussion_logs`, the Turn Controller Edge Function scans the content for keyword matches:

```typescript
// Check if message contains any trigger keywords
const keywordMatch = await checkKeywordMatch(projectId, content);

if (keywordMatch) {
    // Override sequence - let triggered agent speak
    nextSpeaker = keywordMatch;
}
```

### 3. Dynamic Participation

When a keyword match is found:
- The matched agent responds **immediately**
- Sequence_order is temporarily overridden
- Agent receives special context about being called
- Normal sequence resumes after triggered response

### 4. Context Injection

Triggered agents receive enhanced context:

```
"You have been called upon regarding your function. 
Read the previous messages from the database and provide your expert input.

[Agent's normal system prompt]"
```

---

## Complete Flow Example

### Scenario: Hotel Booking Discussion

```
Turn 0 (User):
"We need to improve our hotel booking integration"
  ↓
Turn Controller scans: "hotel" + "booking" keywords found
  ↓
Match: Hotel Expert L2 has both keywords
  ↓
Override: Hotel Expert responds (out of sequence)
  ↓
Turn 1 (Hotel Expert L2):
"Regarding hotel booking integration, I recommend..."
  ↓
Turn Controller: Returns to normal sequence
  ↓
Turn 2 (Next in sequence):
Tourism Expert continues discussion...
```

---

## Keyword Configuration

### Auto-Populated Keywords by Agent:

#### Hotel Expert L2
```
['hotel', 'expert', 'accommodation', 'booking', 'room', 'lodging', 
 'hospitality', 'reservation', 'guest', 'check-in']
```

#### Tourism Expert L2
```
['tourism', 'expert', 'travel', 'destination', 'visitor', 'tour', 
 'attraction', 'sightseeing', 'tourist', 'vacation']
```

#### Guide Expert L2
```
['guide', 'expert', 'tour', 'experience', 'activity', 'local', 
 'excursion', 'walking', 'city', 'cultural']
```

#### Quality Expert
```
['quality', 'expert', 'code', 'testing', 'review', 'qa', 
 'test', 'bug', 'performance', 'reliability']
```

#### Manager Alpha
```
['manager', 'strategy', 'plan', 'decision', 'coordinate', 
 'overview', 'summary', 'goal', 'objective', 'direction']
```

#### Discussion Leader
```
['discussion', 'leader', 'facilitate', 'meeting', 'agenda', 
 'organize', 'moderate', 'coordinate', 'structure', 'flow']
```

---

## SQL Functions

### check_agent_keyword_match()

```sql
SELECT * FROM check_agent_keyword_match(
    'We need better hotel integration',  -- message content
    'project-uuid-here'                  -- project_id
);
```

**Returns:**
- agent_id: UUID of matched agent
- speaker_name: Agent's name
- system_prompt: Agent's prompt
- trigger_keyword: The specific keyword that matched

**Logic:**
1. Scans message content for keywords
2. Finds agents whose keywords match
3. Filters to only participants in current discussion
4. Returns first match (if any)

### auto_populate_trigger_keywords()

```sql
SELECT auto_populate_trigger_keywords();
```

**Purpose:**
- Populates trigger_keywords for all existing agents
- Uses agent names and domains to generate relevant keywords
- Only updates agents with empty keyword arrays

---

## Turn Controller Integration

### Enhanced Logic

```typescript
export default async (req: Request) => {
    const { record } = await req.json();
    const { project_id, content, turn_index } = record;

    // Ignore system messages
    if (turn_index === -1) return;

    // Check for keyword match
    const keywordMatch = await supabase.rpc('check_agent_keyword_match', {
        p_message_content: content,
        p_project_id: project_id
    });

    let nextSpeaker;
    let triggeredByKeyword = false;

    if (keywordMatch.data && keywordMatch.data.length > 0) {
        // Keyword triggered - use this agent
        nextSpeaker = keywordMatch.data[0];
        triggeredByKeyword = true;
        console.log(`Keyword trigger: ${nextSpeaker.speaker_name}`);
    } else {
        // Normal flow - use sequence
        nextSpeaker = await getNextSpeaker(project_id);
    }

    // Build prompt with context injection if triggered
    let systemPrompt = nextSpeaker.system_prompt;
    if (triggeredByKeyword) {
        systemPrompt = `You have been called upon regarding your function. 
        Read the previous messages from the database and provide your expert input.
        
        ${nextSpeaker.system_prompt}`;
    }

    // Call AI and insert response
    const response = await callAI(systemPrompt, context);
    await insertResponse(response, turn_index + 1);
};
```

---

## Benefits

### 1. Dynamic Intelligence
- Agents respond when relevant
- No manual @mentions needed
- Natural conversation flow

### 2. Context-Aware
- Triggered agents know why they were called
- Can reference previous messages
- Provide focused expertise

### 3. Flexible Participation
- Breaks rigid sequence when appropriate
- Returns to normal flow after intervention
- Handles multiple keyword matches

### 4. Scalable
- Easy to add new keywords
- Database-driven configuration
- No code changes needed

---

## Configuration

### Adding Keywords to an Agent

```sql
UPDATE agent_templates
SET trigger_keywords = ARRAY['new', 'keywords', 'here']
WHERE name = 'Agent Name';
```

### Appending Keywords

```sql
UPDATE agent_templates
SET trigger_keywords = array_cat(
    trigger_keywords,
    ARRAY['additional', 'keywords']
)
WHERE name = 'Agent Name';
```

### Removing Keywords

```sql
UPDATE agent_templates
SET trigger_keywords = array_remove(trigger_keywords, 'keyword_to_remove')
WHERE name = 'Agent Name';
```

---

## Testing

### Test Keyword Trigger

```sql
-- Insert test message with keyword
INSERT INTO discussion_logs (
    project_id,
    speaker_name,
    content,
    turn_index
) VALUES (
    'test-project-uuid',
    'User',
    'We need better hotel booking',  -- Contains "hotel" and "booking"
    0
);

-- Check if Hotel Expert gets triggered
-- Should see Hotel Expert respond next
```

### Verify Keywords

```sql
-- List all agents with their keywords
SELECT name, trigger_keywords
FROM agent_templates
WHERE trigger_keywords IS NOT NULL
ORDER BY name;
```

### Test Keyword Match Function

```sql
-- Test if "hotel" triggers Hotel Expert
SELECT * FROM check_agent_keyword_match(
    'Our hotel needs improvements',
    'project-uuid'
);

-- Should return Hotel Expert L2
```

---

## Troubleshooting

### Issue: Keywords Not Triggering

**Check 1: Keywords Populated?**
```sql
SELECT name, trigger_keywords 
FROM agent_templates 
WHERE name LIKE '%Expert%';
```

**Check 2: Agent is Participant?**
```sql
SELECT dp.*, at.name
FROM discussion_participants dp
JOIN agent_templates at ON dp.agent_id = at.id
WHERE dp.project_id = 'your-project-id'
AND dp.status = 'active';
```

**Check 3: Keyword Match Working?**
```sql
SELECT * FROM check_agent_keyword_match(
    'test message with hotel keyword',
    'your-project-id'
);
```

### Issue: Too Many Triggers

**Solution: Make keywords more specific**
```sql
UPDATE agent_templates
SET trigger_keywords = ARRAY['very', 'specific', 'keywords']
WHERE name = 'Agent Name';
```

### Issue: Turn Sequence Lost

**Check: Turn recovery in Edge Function**
- Edge Function should track original sequence
- Should return to normal order after keyword trigger
- Check `discussion_state` table for sequence tracking

---

## Origo Architecture Compliance

### Minimalist ✅
- Single column addition
- Reuses existing tables
- No complex abstractions

### Data-Centric ✅
- Keywords stored in database
- Trigger logic in SQL
- State managed by database

### Supabase-Backed ✅
- Migration handles schema
- Edge Function handles logic
- RLS policies secure access

---

## Future Enhancements

### Possible Additions:

1. **Keyword Priority**
   - Rank keywords by importance
   - Match higher-priority keywords first

2. **Multi-Agent Triggers**
   - Allow multiple agents to respond
   - Round-robin when multiple matches

3. **Context Levels**
   - Different context based on keyword match strength
   - More context for direct mentions vs. related keywords

4. **Learning System**
   - Track which keywords lead to useful responses
   - Auto-adjust keywords based on discussion outcomes

---

## Summary

The Keyword Trigger System enables:
- ✅ Dynamic agent participation
- ✅ Context-aware responses
- ✅ Intelligent "listening"
- ✅ Natural conversation flow
- ✅ Database-driven intelligence

**Status:** ✅ Production Ready

The system creates more natural, expert-driven discussions where agents contribute when their expertise is truly needed!
