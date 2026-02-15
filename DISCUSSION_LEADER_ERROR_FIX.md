# Discussion Leader Error Fix

## Problem

**Error Message:** "Discussion Leader agent not found"

This error occurs when the application tries to fetch the Discussion Leader agent from the database but cannot find it.

---

## Root Cause

The Discussion Leader agent may not exist in the database for several reasons:

1. **Migrations not run** - Database migrations haven't been applied
2. **Organization mismatch** - Agent exists but with different organization_id
3. **Missing constraint** - Unique constraint on (name, organization_id) not present
4. **Deleted agent** - Agent was manually deleted

---

## Solution

### Quick Fix: Run the Migration

Apply the comprehensive fix migration:

```bash
# Using Supabase CLI
supabase db push

# Or apply specific migration
psql $DATABASE_URL -f supabase/migrations/20260215173000_ensure_discussion_leader_exists.sql
```

### What the Migration Does

**File:** `20260215173000_ensure_discussion_leader_exists.sql`

1. **Ensures Unique Constraint** - Adds constraint on (name, organization_id) if missing
2. **Creates Discussion Leader** - Creates agent as GLOBAL (organization_id = NULL)
3. **Updates if Exists** - Updates existing agent to ensure correct configuration
4. **Verifies Creation** - Checks that agent exists and reports status
5. **Creates Manager Alpha** - Also ensures Manager Alpha exists (required for discussions)

### Key Features

- **Global Agent**: Created with `organization_id = NULL` so it's available to all organizations
- **Idempotent**: Can be run multiple times safely
- **Verification**: Includes checks and reports success/failure
- **Comprehensive**: Handles both creation and update scenarios

---

## Verification

### Check if Discussion Leader Exists

```sql
SELECT id, name, organization_id, level, category
FROM agent_templates
WHERE name = 'Discussion Leader';
```

**Expected Result:**
```
id                  | name              | organization_id | level | category
--------------------|-------------------|-----------------|-------|----------
<uuid>              | Discussion Leader | NULL            | 3     | Discussion
```

### Check Migration Applied

```sql
-- Check if migration ran
SELECT * FROM supabase_migrations
WHERE name LIKE '%ensure_discussion_leader%';
```

---

## Manual Fix (If Migration Doesn't Work)

If the migration fails, you can manually create the agent:

```sql
INSERT INTO public.agent_templates (
    name,
    description,
    level,
    system_prompt,
    organization_id,
    category,
    icon,
    search_keywords,
    ai_model_config,
    produced_by
)
VALUES (
    'Discussion Leader',
    'Moderiert strukturierte Multi-Agent Diskussionen mit definierten Regeln und Ablauf.',
    3,
    'Du bist der Discussion Leader. Deine Aufgabe ist es, strukturierte Diskussionen zu moderieren.

WENN ein Nutzer eine Diskussion starten möchte:
1. Analysiere das Projekt/Thema
2. Empfehle relevante Agenten basierend auf dem Thema
3. Schlage Diskussionsregeln vor
4. Warte auf Bestätigung vom Nutzer
5. Starte die moderierte Diskussion

Antworte in kurzen, klaren Sätzen. Nutze Format: [Discussion Leader]: Text',
    NULL, -- Global agent
    'Discussion',
    'users',
    ARRAY['discussion', 'leader', 'moderation', 'mas'],
    '{"provider":"groq","model":"llama-3.1-8b-instant","temperature":0.2}'::jsonb,
    'manual:fix-discussion-leader'
)
ON CONFLICT (name, organization_id) DO UPDATE
SET
    description = EXCLUDED.description,
    level = EXCLUDED.level,
    system_prompt = EXCLUDED.system_prompt,
    updated_at = now();
```

---

## Testing

### Test 1: Verify Agent Exists

```bash
# Query the database
psql $DATABASE_URL -c "SELECT name, level FROM agent_templates WHERE name = 'Discussion Leader';"
```

**Expected:** Should return 1 row

### Test 2: Test API Endpoint

```bash
# Test the manager-discussion endpoint
curl -X POST http://localhost:3000/api/manager-discussion \
  -H "Content-Type: application/json" \
  -d '{"message": "I want to have a discussion about tourism", "phase": "initiation"}'
```

**Expected:** Should NOT return "Discussion Leader agent not found" error

### Test 3: Test in Application

1. Navigate to `/main-dashboard` or `/manager-alpha`
2. Type: "Let's have a discussion about tourism"
3. Send message
4. **Expected:** Discussion Leader should respond with agent suggestions

---

## Troubleshooting

### Error: Unique constraint violation

**Cause:** Agent already exists with different organization_id

**Fix:**
```sql
-- Delete duplicate agents (keep one)
DELETE FROM agent_templates
WHERE name = 'Discussion Leader'
  AND id NOT IN (
    SELECT id FROM agent_templates
    WHERE name = 'Discussion Leader'
    ORDER BY created_at DESC
    LIMIT 1
  );

-- Then run migration again
```

### Error: Permission denied

**Cause:** Insufficient database permissions

**Fix:** Run migration with admin/service role:
```bash
# Using service role key
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
psql $SUPABASE_DB_URL -f supabase/migrations/20260215173000_ensure_discussion_leader_exists.sql
```

### Error: Agent exists but still not found

**Cause:** API query filter issue

**Fix:** The API has fallback logic that should handle this, but verify:

```sql
-- Check what organization_id the agent has
SELECT id, name, organization_id 
FROM agent_templates 
WHERE name = 'Discussion Leader';

-- If it has an organization_id, either:
-- Option 1: Set it to NULL (global)
UPDATE agent_templates 
SET organization_id = NULL 
WHERE name = 'Discussion Leader';

-- Option 2: Ensure your user belongs to that organization
SELECT * FROM profiles WHERE id = '<your-user-id>';
```

---

## Prevention

To prevent this error in the future:

1. **Always run migrations** on new environments
2. **Use migration scripts** instead of manual SQL
3. **Verify critical agents** after deployment
4. **Use global agents** (organization_id = NULL) for system agents

---

## Related Files

- **Migration:** `supabase/migrations/20260215173000_ensure_discussion_leader_exists.sql`
- **API Route:** `app/api/manager-discussion/route.ts` (lines 192-199)
- **Original Migrations:**
  - `20260215080000_discussion_leader_agent.sql`
  - `20260215161500_fix_discussion_leader_constraint.sql`

---

## Summary

**Problem:** Discussion Leader agent not found
**Solution:** Run comprehensive migration that creates agent as global
**Status:** ✅ Fixed

The migration ensures the Discussion Leader always exists and is accessible, preventing the "agent not found" error.
