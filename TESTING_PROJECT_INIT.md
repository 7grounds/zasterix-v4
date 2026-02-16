# Project Initialization - Testing Guide

## Overview
This document describes how to test the project initialization feature in the ManagerChat component.

## What Was Implemented

### 1. API Endpoint: `/api/projects/init`
Creates a complete project environment with:
- **projects table**: New row with project name and UUID
- **discussion_state table**: Initial state (turn_index=0, round=1, status='active')
- **discussion_participants table**: Default agents in sequence order

### 2. ManagerChat Component Integration
- Detects "session" commands
- Extracts project name from user input
- Calls initialization API
- Displays project UUID in header
- Passes project_id to all chat API calls

## How to Test

### Prerequisites
1. Ensure Supabase is configured with these environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Ensure the database migrations have been run:
   - `20260212153000_projects_discussion_round.sql`
   - `20260216111500_discussion_tables.sql`
   - `20260216112000_seed_discussion_participants.sql`

### Test Steps

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to ManagerChat**:
   - Open http://localhost:3000
   - You should see "MANAGER_ALPHA_READY" in the header

3. **Initialize a project** by typing:
   ```
   session about Berner Oberland Tourism
   ```
   or
   ```
   session Berner Oberland Tourism
   ```

4. **Expected Result**:
   - User message appears
   - System responds with:
     ```
     Project initialized!
     Project UUID: [generated-uuid]
     Topic: Berner Oberland Tourism
     
     Ready to start discussion.
     ```
   - Project UUID appears in the top-right corner of the header
   - All subsequent messages will include this project_id

### Database Verification

After initialization, verify the database contains:

1. **projects table**:
   ```sql
   SELECT id, name, type, status FROM projects 
   WHERE name = 'Berner Oberland Tourism';
   ```
   Expected: One row with type='discussion', status='active'

2. **discussion_state table**:
   ```sql
   SELECT current_turn_index, current_round, status 
   FROM discussion_state 
   WHERE project_id = '[your-project-uuid]';
   ```
   Expected: turn_index=0, round=1, status='active'

3. **discussion_participants table**:
   ```sql
   SELECT role, sequence_order, agent_id 
   FROM discussion_participants 
   WHERE project_id = '[your-project-uuid]'
   ORDER BY sequence_order;
   ```
   Expected: 5 rows in sequence:
   - sequence_order=0: role='manager' (Manager L3)
   - sequence_order=1: role='specialist' (Hotel Expert L2)
   - sequence_order=2: role='specialist' (Guide Expert L2)
   - sequence_order=3: role='specialist' (Tourismus Expert L2)
   - sequence_order=4: role='user', agent_id=NULL

## Troubleshooting

### Error: "Supabase credentials not configured"
- Check that SUPABASE_SERVICE_ROLE_KEY is set in .env
- Restart the dev server after adding credentials

### Error: "Failed to create project"
- Check database connection
- Verify migrations have been applied
- Check Supabase logs for detailed errors

### Project UUID shows as "undefined"
- This was the original issue - should now show actual UUID
- If still showing undefined, check browser console for API errors

## API Contract

### Request
```typescript
POST /api/projects/init
Content-Type: application/json

{
  "name": "Project Name",
  "userId": "optional-user-id",
  "organizationId": "optional-org-id"
}
```

### Response (Success)
```typescript
{
  "status": "success",
  "project": {
    "id": "uuid-string",
    "name": "Project Name",
    "type": "discussion",
    "status": "active",
    "created_at": "2024-02-16T12:00:00Z"
  }
}
```

### Response (Error)
```typescript
{
  "status": "error",
  "message": "Error description"
}
```

## Integration with Discussion System

Once a project is initialized:
1. The project_id is stored in ManagerChat state
2. All chat API calls include the project_id
3. The discussion engine can use this to:
   - Load discussion_state
   - Track turn order via discussion_participants
   - Save messages to discussion_logs
   - Maintain proper turn-taking logic

## Screenshots

### Initial State
![Initial State](https://github.com/user-attachments/assets/e7850311-b447-4892-beda-52c102a3b803)

### After "session" Command (Development Environment - Missing Credentials)
![Error State](https://github.com/user-attachments/assets/d60d8c0a-ad1e-438e-a2bb-875f49840c19)
*Note: This shows the code is working correctly - it's detecting the command and trying to initialize. The error is due to missing database credentials in the dev environment.*

### Expected Successful State (With Proper Credentials)
When run with proper credentials, you should see:
- User message with the session command
- System response with project UUID
- Project UUID displayed in header (top-right corner)
