# Project Initialization - Quick Reference

## Problem
Projects table empty → "Project UUID: undefined"

## Solution
1. ✅ Added RLS policies
2. ✅ Added topic_objective field
3. ✅ Enhanced logging
4. ✅ Better error handling

---

## Apply Migrations

```bash
# 1. RLS policies
psql $DATABASE_URL -f supabase/migrations/20260216162900_add_projects_rls_policies.sql

# 2. Topic objective field
psql $DATABASE_URL -f supabase/migrations/20260216163000_add_topic_objective_field.sql
```

---

## Console Log Format

### Server-Side (API)
```
📝 Creating project: <name>
✅ Project created successfully!
   Project ID: <uuid>
   Project name: <name>
📝 Creating discussion_state for project: <uuid>
✅ Discussion state created successfully
📝 Loading agent templates for participants...
✅ Loaded <n> agent templates
   Agent mapped: <name> → <uuid>
📝 Creating discussion participants...
✅ Created <n> participants
🎉 Project initialization complete!
   Project ID: <uuid>
   Ready for Manager Alpha to start
```

### Client-Side (ManagerChat)
```
🚀 Initializing project...
   Project name: <name>
📥 API Response: {status: 'success', ...}
✅ Project initialized successfully!
   Project ID: <uuid>
   Topic: <topic>
   Participants: <n>
```

---

## Verification Queries

### Check Project Created
```sql
SELECT id, name, topic_objective, status, created_at 
FROM projects 
ORDER BY created_at DESC 
LIMIT 1;
```

### Check Discussion State
```sql
SELECT * 
FROM discussion_state 
WHERE project_id = '<project_id>';
```

### Check Participants
```sql
SELECT role, sequence_order, agent_id 
FROM discussion_participants 
WHERE project_id = '<project_id>' 
ORDER BY sequence_order;
```

### Check RLS Policies
```sql
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'projects';
```

---

## Common Issues

### Issue: Project not created
**Check**: Service role key configured?
```bash
echo $SUPABASE_SERVICE_ROLE_KEY
```

### Issue: UUID undefined
**Check**: Server console for error logs
**Look for**: "❌ Project creation error"

### Issue: Participants missing
**Check**: Agent templates exist?
```sql
SELECT id, name FROM agent_templates 
WHERE name IN (
  'Manager L3', 
  'Hotel Expert L2', 
  'Guide Expert L2', 
  'Tourismus Expert L2'
);
```

---

## Testing Command

In ManagerChat UI, type:
```
session about Berner Oberland Tourism
```

Expected output:
```
Project initialized!

Project UUID: 6e44f3ea-7d88-4fc8-b0ea-a1f41a7ec8df
Topic: Berner Oberland Tourism
Participants: 5

Ready to start discussion. Manager Alpha is standing by.
```

---

## Key Files

- **RLS Policies**: `supabase/migrations/20260216162900_add_projects_rls_policies.sql`
- **Topic Field**: `supabase/migrations/20260216163000_add_topic_objective_field.sql`
- **API Route**: `app/api/projects/init/route.ts`
- **UI Component**: `components/ManagerChat.tsx`
- **Full Docs**: `PROJECT_INITIALIZATION_FIX.md`

---

## Requirements Met

✅ **Schreiblogik**: Insert uses `.select().single()`  
✅ **UUID Handshake**: Logged and passed correctly  
✅ **RLS**: 5 policies created  
✅ **Manager Trigger**: Only after complete setup  
✅ **Dynamic Topic**: Uses `topic_objective` field  
