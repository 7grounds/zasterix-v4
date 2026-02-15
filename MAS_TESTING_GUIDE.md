# MAS Discussion System - Testing Guide

## Overview
The Multi-Agent System (MAS) Discussion System allows structured discussions between AI agents moderated by a Discussion Leader, initiated through Manager Alpha.

## System Components

### 1. Manager Alpha
- **Role**: Main coordinator and discussion initiator
- **Location**: `/manager-alpha`
- **Purpose**: Recognizes when user wants to start a discussion and delegates to Discussion Leader

### 2. Discussion Leader
- **Role**: Moderates structured multi-agent discussions
- **Purpose**: 
  - Proposes discussion configuration (agents, rules, rounds)
  - Manages turn-taking
  - Ensures rules are followed

### 3. Participating Agents
Available agents for discussions:
- **Manager L3**: Strategic management perspective
- **Hotel Expert L2**: Hotel operations and B2B hospitality
- **Guide Expert L2**: Alpine guide expertise
- **Tourismus Expert L2**: Regional tourism strategy
- **Experience Curator BO (L2)**: Experience design
- **Hotel-Hub-Integrator (L2)**: Hotel network integration

## How to Test

### Step 1: Access Manager Alpha
1. Navigate to `/manager-alpha` in your browser
2. You should see the Manager Alpha interface with a welcome message

### Step 2: Initiate a Discussion
Type a message that includes "discussion" or "meeting" and mentions a topic, for example:

```
"I want to have a discussion about improving tourism in Berner Oberland"
```

or

```
"Let's have a meeting to discuss hotel partnership strategies"
```

### Step 3: Review Discussion Proposal
Manager Alpha will hand off to the Discussion Leader, who will propose:
- **Topic**: Based on your message
- **Agents**: Recommended participants based on the topic
- **Rules**: 3 lines per agent, 3 rounds
- **Participants**: Agents + You

### Step 4: Confirm Discussion
Type one of these to confirm:
- `ja`
- `bestätigt`
- `yes`
- `confirm`

### Step 5: Participate in Discussion
- Manager L3 will open the discussion
- Each agent will contribute in turn (max 3 lines)
- After each agent speaks, you can add your input
- This continues for 3 rounds

### Step 6: Review Summary
After all rounds complete:
- Manager L3 automatically generates a summary
- Summary is saved to the projects table
- All messages are logged in discussion_logs table

## Example Test Scenarios

### Scenario 1: Tourism Strategy Discussion
**User Input**: "discussion about increasing tourism revenue in winter season"

**Expected Agents**: Manager L3, Hotel Expert L2, Tourismus Expert L2, Experience Curator BO

**Sample Flow**:
1. Manager Alpha → Discussion Leader (proposes config)
2. User confirms
3. Manager L3 opens discussion
4. Hotel Expert L2 contributes
5. User adds input
6. Tourismus Expert L2 contributes
7. User adds input
8. Experience Curator contributes
9. (Repeat for 3 rounds)
10. Manager L3 provides summary

### Scenario 2: Technical Integration Meeting
**User Input**: "meeting about integrating new hotel booking systems"

**Expected Agents**: Manager L3, Hotel-Hub-Integrator, Hotel Expert L2

### Scenario 3: Experience Design Discussion
**User Input**: "discussion on creating authentic alpine experiences"

**Expected Agents**: Manager L3, Guide Expert L2, Experience Curator BO

## Data Storage

### Projects Table
- New project created with type="discussion"
- Metadata includes rules, speaker_order, agents, topic
- Summary added on completion
- Status changes from "active" to "completed"

### Discussion Logs Table
- Each message (agent or user) logged separately
- Links to project_id and agent_id
- Includes speaker_name and content
- Timestamped with created_at

### Universal History Table
- Each turn logged with full context
- Type: "discussion_start", "discussion_turn", or "discussion_summary"
- Includes round number and speaker information

## Verification Checklist

After running a complete discussion, verify:

- [ ] Project created in `projects` table with type="discussion"
- [ ] All messages appear in `discussion_logs` table
- [ ] Entries in `universal_history` table reference correct project_id
- [ ] Summary saved in project metadata
- [ ] Project status changed to "completed"
- [ ] All agents contributed within line limits (3 lines)
- [ ] Exactly 3 rounds occurred
- [ ] User could participate after each agent
- [ ] Manager L3 provided final summary

## API Endpoints

### `/api/manager-discussion`
**Method**: POST

**Phases**:
1. `initiation` - Detects discussion request, calls Discussion Leader
2. `confirmation` - User confirms proposed configuration
3. `discussion` - Active discussion with turn-taking
4. `summary` - Generate and save summary
5. `complete` - Discussion finished

**Request Body**:
```json
{
  "message": "user message",
  "userId": "uuid",
  "organizationId": "uuid",
  "phase": "initiation|confirmation|discussion|summary",
  "discussionConfig": {
    "agents": ["Manager L3", "Hotel Expert L2"],
    "linesPerAgent": 3,
    "rounds": 3,
    "topic": "discussion topic"
  },
  "currentRound": 1,
  "currentAgentIndex": 0,
  "projectId": "uuid"
}
```

## Troubleshooting

### "Manager Alpha agent not found"
- Ensure migration `20260215080000_discussion_leader_agent.sql` has been applied
- Check that agent_templates table contains "Manager Alpha"

### "Discussion Leader agent not found"
- Ensure migration `20260215080000_discussion_leader_agent.sql` has been applied
- Check that agent_templates table contains "Discussion Leader"

### "GROQ_API_KEY not configured"
- Set GROQ_API_KEY in your .env file
- Restart the application

### No response from agents
- Check GROQ_API_KEY is valid
- Check network connectivity
- Review server logs for API errors

### Discussion logs not saving
- Ensure migration `20260215081000_discussion_logs_table.sql` has been applied
- Check database permissions
- Verify userId is provided in requests

## Architecture Notes

### Flow Diagram
```
User Message (with "discussion") 
    ↓
Manager Alpha (recognizes keyword)
    ↓
Discussion Leader (proposes config)
    ↓
User Confirmation
    ↓
Create Project in DB
    ↓
Manager L3 Opens Discussion
    ↓
[For each agent in turn, 3 rounds]
    Agent contributes (max 3 lines)
    → Save to discussion_logs
    → Save to universal_history
    ↓
    User can respond
    → Save to discussion_logs
    → Save to universal_history
    ↓
[End of rounds]
    ↓
Manager L3 Generates Summary
    ↓
Save summary to project metadata
    ↓
Update project status to "completed"
```

### Agent Selection Logic
Discussion Leader analyzes the topic and selects relevant agents:
- **Tourism keywords**: Manager L3, Hotel Expert, Tourismus Expert, Guide Expert
- **Technology keywords**: Manager L3, relevant tech experts
- **Strategy keywords**: Manager L3, Experience Curator, Hotel-Hub-Integrator

### Rules Enforcement
- Line limit: Enforced via system prompts ("Maximal 3 Zeilen")
- Round limit: Tracked in API route state
- Turn-taking: Managed by currentAgentIndex and nextSpeaker
- User participation: Allowed after each agent via nextSpeaker="user"

## Future Enhancements
- [ ] Custom rule configuration (lines per agent, number of rounds)
- [ ] Agent voting on decisions
- [ ] Real-time WebSocket updates
- [ ] Discussion transcripts export
- [ ] Agent performance metrics
- [ ] Discussion templates for common topics
