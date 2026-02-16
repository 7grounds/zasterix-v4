# Bulk Agent Metadata Standardization

## Overview
This document describes the bulk tagging and standardization system for agent templates, enabling intelligent agent selection for discussion projects.

## Problem Statement
The agent library (`public.agent_templates`) needs standardized metadata so the discussion system can intelligently select appropriate agents based on project requirements.

## Solution

### 1. SQL Migration
**File**: `supabase/migrations/20260216121800_bulk_agent_metadata_standardization.sql`

Automatically updates all agents in the database to:
- Add standardized discipline tags
- Add trigger keywords for pattern matching
- Set engine_type for managers
- Categorize tourism-related agents
- Standardize provider to 'groq' and model to 'llama-3.1-8b-instant'
- Generate unique code_names for all agents

### 2. Node.js Script
**File**: `scripts/bulk-tag-agents.js`

Provides a flexible way to apply updates with dry-run capability.

## Categorization Rules

### Design/UI Agents
**Triggers**: Name or description contains:
- "Design", "UI", "UX", "User Interface"

**Updates**:
- `discipline` → 'frontend_design'
- `trigger_keywords` → ['responsive', 'ux', 'visuals']

### DevOps/Infrastructure Agents
**Triggers**: Name or description contains:
- "DevOps", "Cloud", "Infrastructure", "Deployment"

**Updates**:
- `discipline` → 'infrastructure'
- `trigger_keywords` → ['deployment', 'scaling', 'security']

### Manager/Lead Agents
**Triggers**: Name or description contains:
- "Manager", "Lead", "Director"

**Updates**:
- `engine_type` → 'manager_logic'

### Tourism Category
**Triggers**: Name or description contains:
- "Tourism", "Tourismus", "Hotel", "Guide", "Berner Oberland", "Destination"

**Updates**:
- `category` → 'Tourism'

## Code Name Generation

Each agent must have a unique `code_name` for use in `discussion_participants`.

**Format**: `NORMALIZED_NAME_UUID_PREFIX`

**Example**:
- Name: "Manager L3"
- UUID: "6e44f3ea-7d88-4fc8-b0ea-a1f41a7ec8df"
- code_name: "MANAGER_L3_6e44f3ea"

**Uniqueness**: If duplicates exist, appends sequence number: `MANAGER_L3_6e44f3ea_2`

## Provider Standardization

All agents updated to use the Groq cluster:
- `provider` → 'groq'
- `model_name` → 'llama-3.1-8b-instant'

**Note**: Agents previously set to 'xAI' are migrated to Groq.

## Usage

### Option 1: SQL Migration (Recommended)
Run the migration directly in Supabase:

```bash
# Apply migration
psql $DATABASE_URL -f supabase/migrations/20260216121800_bulk_agent_metadata_standardization.sql
```

Or through Supabase CLI:
```bash
supabase db push
```

### Option 2: Node.js Script

**Dry Run** (See what would be updated):
```bash
node scripts/bulk-tag-agents.js --dry-run
```

**Live Update**:
```bash
node scripts/bulk-tag-agents.js
```

**Prerequisites**:
- NEXT_PUBLIC_SUPABASE_URL environment variable
- SUPABASE_SERVICE_ROLE_KEY environment variable

## Expected Results

After running the standardization:

1. **Design Agents**: 
   - Have `discipline='frontend_design'`
   - Have trigger keywords for UI/UX work
   
2. **DevOps Agents**:
   - Have `discipline='infrastructure'`
   - Have trigger keywords for deployment/scaling
   
3. **Manager Agents**:
   - Have `engine_type='manager_logic'`
   - Can be identified for coordination roles
   
4. **Tourism Agents**:
   - Have `category='Tourism'`
   - Easily filterable for Berner Oberland projects
   
5. **All Agents**:
   - Have unique `code_name`
   - Use 'groq' provider with 'llama-3.1-8b-instant' model
   - Have standardized `ai_model_config`

## Database Schema Changes

### New/Updated Columns

```sql
discipline text              -- Agent specialization
trigger_keywords text[]      -- Keywords for selection logic
engine_type text            -- Type of processing engine
code_name text UNIQUE       -- Unique identifier for participants
provider text               -- LLM provider (standardized to 'groq')
model_name text            -- Model name (standardized to 'llama-3.1-8b-instant')
```

## Integration with Discussion System

### Before Standardization
```javascript
// Had to manually specify agents
const participants = [
  { agent_id: 'uuid1', role: 'manager' },
  { agent_id: 'uuid2', role: 'specialist' }
];
```

### After Standardization
```javascript
// Can intelligently select agents
const manager = await selectAgent({ engine_type: 'manager_logic' });
const designers = await selectAgents({ discipline: 'frontend_design', category: 'Tourism' });
const devops = await selectAgents({ discipline: 'infrastructure' });
```

## Verification Queries

Check standardization results:

```sql
-- Count by discipline
SELECT discipline, COUNT(*) 
FROM agent_templates 
GROUP BY discipline;

-- Count by category
SELECT category, COUNT(*) 
FROM agent_templates 
GROUP BY category;

-- Check for duplicate code_names (should be 0)
SELECT code_name, COUNT(*) 
FROM agent_templates 
GROUP BY code_name 
HAVING COUNT(*) > 1;

-- Tourism agents
SELECT name, category, discipline, code_name
FROM agent_templates
WHERE category = 'Tourism';

-- Managers
SELECT name, engine_type, code_name
FROM agent_templates
WHERE engine_type = 'manager_logic';
```

## Rollback

If needed, you can rollback specific changes:

```sql
-- Clear standardization (but keep code_names)
UPDATE agent_templates
SET 
  discipline = NULL,
  trigger_keywords = NULL,
  engine_type = NULL
WHERE discipline IN ('frontend_design', 'infrastructure')
   OR engine_type = 'manager_logic';
```

## Future Enhancements

1. **Smart Agent Selection API**
   - Endpoint to select agents based on project requirements
   - Example: `/api/agents/select?discipline=frontend_design&category=Tourism`

2. **Agent Matching Score**
   - Algorithm to score agents based on keyword matching
   - Ranks agents by relevance to project topic

3. **Dynamic Agent Assignment**
   - Automatically assign best-fit agents to new projects
   - Based on project metadata and agent specializations

4. **Agent Analytics**
   - Track which agents are used most
   - Identify gaps in agent coverage
   - Suggest new agents to create

## Troubleshooting

### "Duplicate key value violates unique constraint"
- Multiple agents have the same code_name
- Run uniqueness check: `SELECT code_name, COUNT(*) FROM agent_templates GROUP BY code_name HAVING COUNT(*) > 1`
- Fix with sequence numbers or re-generate code_names

### "Provider/model not found in ai_model_config"
- The ai_model_config needs updating
- Migration handles this automatically
- Verify with: `SELECT name, ai_model_config FROM agent_templates WHERE ai_model_config IS NULL`

### Script fails with "Supabase credentials not configured"
- Check environment variables are set
- Verify SERVICE_ROLE_KEY (not just ANON_KEY)
- Restart terminal after setting env vars

## Examples

### Before Standardization
```json
{
  "id": "abc-123",
  "name": "Hotel Designer",
  "description": "Designs hotel interfaces",
  "discipline": null,
  "trigger_keywords": null,
  "engine_type": null,
  "code_name": null,
  "provider": "xAI",
  "model_name": "grok-beta"
}
```

### After Standardization
```json
{
  "id": "abc-123",
  "name": "Hotel Designer",
  "description": "Designs hotel interfaces",
  "discipline": "frontend_design",
  "trigger_keywords": ["responsive", "ux", "visuals"],
  "engine_type": null,
  "code_name": "HOTEL_DESIGNER_abc123",
  "category": "Tourism",
  "provider": "groq",
  "model_name": "llama-3.1-8b-instant"
}
```

## Conclusion

The bulk metadata standardization ensures all agents have:
1. ✅ Consistent categorization for intelligent selection
2. ✅ Unique code_names for discussion participants
3. ✅ Standardized provider/model configuration
4. ✅ Trigger keywords for pattern matching
5. ✅ Engine type specifications for role assignment

This enables the discussion system to automatically select the most appropriate agents for any given project.
