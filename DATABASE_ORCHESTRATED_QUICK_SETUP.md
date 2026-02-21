# Database-Orchestrated System - Quick Setup Guide

## 🚀 Quick Start (5 Steps)

### Step 1: Run Database Migrations

The migrations create the necessary tables and functions:

```bash
# Option A: Automatic (on next deploy)
git push

# Option B: Manual
supabase db push
```

**What gets created:**
- ✅ `discussion_participants` table
- ✅ `turn_index` column in discussion_logs
- ✅ `recruit_specialists_for_discussion()` function
- ✅ `seal_discussion_recruitment()` function
- ✅ `get_next_speaker()` function

### Step 2: Deploy Edge Function

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref idsifdlczfhhabqaytma

# Deploy the turn-controller function
supabase functions deploy turn-controller

# Set environment secrets
supabase secrets set GROQ_API_KEY=your_groq_key_here
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_key_here
```

**Verify deployment:**
```bash
supabase functions list
# Should show: turn-controller
```

### Step 3: Configure Webhook

1. **Go to Supabase Dashboard:** https://supabase.com/dashboard
2. **Navigate to:** Database → Webhooks
3. **Click:** Create new webhook
4. **Configure:**
   ```
   Name: Discussion Turn Controller
   Table: discussion_logs
   Events: ✓ INSERT
   Type: HTTP Request
   Method: POST
   URL: https://idsifdlczfhhabqaytma.supabase.co/functions/v1/turn-controller
   HTTP Headers:
     Authorization: Bearer eyJhbGciOi... [your anon key]
   ```

**Get your anon key:**
```
Dashboard → Settings → API → Project API keys → anon public
```

### Step 4: Test the System

#### Test A: Recruitment

```sql
-- In Supabase SQL Editor:

-- 1. Create test project
INSERT INTO projects (id, name, type, status, organization_id)
VALUES (
    gen_random_uuid(),
    'Test Tourism Discussion',
    'discussion',
    'active',
    '17b2f0fe-f89d-47b1-9fd4-aafe1a327388'
)
RETURNING id;

-- Copy the returned UUID and use it below

-- 2. Recruit specialists
SELECT * FROM recruit_specialists_for_discussion(
    'paste-uuid-here',
    ARRAY['tourism', 'expert']
);

-- Should return 5 rows:
-- Manager L3 (seq 0)
-- Discussion Leader (seq 1)
-- Specialist A (seq 2)
-- Specialist B (seq 3)
-- User (seq 4)
```

#### Test B: Sealing

```sql
-- 3. Seal the recruitment
SELECT seal_discussion_recruitment(
    'paste-uuid-here',
    auth.uid(),
    '17b2f0fe-f89d-47b1-9fd4-aafe1a327388'
);

-- Should return:
-- {"success": true, "participant_count": 5, ...}

-- 4. Verify system message
SELECT * FROM discussion_logs 
WHERE project_id = 'paste-uuid-here' 
AND turn_index = -1;

-- Should show "System Ready" message
```

#### Test C: Turn Controller

```sql
-- 5. Start the conversation (user message)
INSERT INTO discussion_logs (
    project_id, 
    speaker_name, 
    content, 
    turn_index
) VALUES (
    'paste-uuid-here',
    'User',
    'Let's discuss how to improve winter tourism in Berner Oberland',
    0
);

-- 6. Wait 2-3 seconds, then check for automatic responses:
SELECT 
    speaker_name, 
    content, 
    turn_index, 
    created_at 
FROM discussion_logs 
WHERE project_id = 'paste-uuid-here'
ORDER BY created_at;

-- Should show:
-- turn_index -1: System Ready (Discussion Leader)
-- turn_index 0: User message
-- turn_index 1: Specialist A response (automatic!)
-- turn_index 2: Specialist B response (automatic!)
-- turn_index 3: [waiting for next turn]
```

### Step 5: Monitor Edge Function

```bash
# View real-time logs
supabase functions logs turn-controller --follow

# You should see:
# - "Turn Controller triggered"
# - "Next speaker: [agent name]"
# - "Claude response received" or "Groq response received"
# - "Response inserted successfully"
```

---

## 📊 Visual Flow

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                       │
│  (Frontend just displays discussion_logs via Realtime) │
└─────────────────────────────────────────────────────────┘
                          │
                          │ INSERT message
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  DATABASE: discussion_logs              │
│  [User message with turn_index = 0]                    │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Webhook INSERT trigger
                          ↓
┌─────────────────────────────────────────────────────────┐
│           EDGE FUNCTION: turn-controller                │
│  1. get_next_speaker(project_id)                       │
│  2. Fetch discussion context                           │
│  3. Call Claude/Groq API                               │
│  4. INSERT response to discussion_logs                 │
└─────────────────────────────────────────────────────────┘
                          │
                          │ INSERT response (turn_index = 1)
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  DATABASE: discussion_logs              │
│  [Agent response with turn_index = 1]                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Webhook INSERT trigger
                          ↓
┌─────────────────────────────────────────────────────────┐
│           EDGE FUNCTION: turn-controller                │
│  (Repeats for next agent)                              │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Continues until...
                          ↓
┌─────────────────────────────────────────────────────────┐
│  get_next_speaker() returns is_user = true             │
│  Edge Function STOPS, waits for user input             │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### Issue: "Edge Function not found"

```bash
# Check if deployed
supabase functions list

# If not listed, deploy:
supabase functions deploy turn-controller
```

### Issue: "Webhook not triggering"

1. **Check webhook status:**
   - Dashboard → Database → Webhooks
   - Ensure status is "Active" (green dot)

2. **Test webhook manually:**
   ```bash
   curl -X POST https://idsifdlczfhhabqaytma.supabase.co/functions/v1/turn-controller \
     -H "Authorization: Bearer [anon-key]" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "INSERT",
       "table": "discussion_logs",
       "record": {
         "project_id": "test-uuid",
         "turn_index": 0
       }
     }'
   ```

### Issue: "Agents not responding"

1. **Check API keys are set:**
   ```bash
   supabase secrets list
   # Should show: GROQ_API_KEY, ANTHROPIC_API_KEY
   ```

2. **Check Edge Function logs:**
   ```bash
   supabase functions logs turn-controller --follow
   ```

3. **Verify get_next_speaker() works:**
   ```sql
   SELECT * FROM get_next_speaker('your-project-uuid');
   ```

### Issue: "UUID invalid input syntax"

Make sure you're using actual UUIDs:
```sql
-- ❌ WRONG
'project-id-here'

-- ✅ CORRECT
'550e8400-e29b-41d4-a716-446655440000'

-- ✅ OR USE
gen_random_uuid()
```

---

## 🎯 Verification Checklist

- [ ] Migrations ran successfully
- [ ] discussion_participants table exists
- [ ] turn_index column added to discussion_logs
- [ ] SQL functions created (recruit, seal, get_next_speaker)
- [ ] Edge Function deployed
- [ ] Secrets set (GROQ_API_KEY, ANTHROPIC_API_KEY)
- [ ] Webhook configured and active
- [ ] Test recruitment works
- [ ] Test sealing works
- [ ] Test turn controller responds automatically
- [ ] Edge Function logs show activity

---

## 📚 Next Steps

1. **Integrate with Frontend:**
   - Update UI to use Realtime subscriptions
   - Remove setTimeout logic
   - Make frontend read-only viewer

2. **Refactor API Route:**
   - Add Manager L3 greeting phase
   - Add topic collection phase
   - Call recruitment functions
   - Call sealing function

3. **Test with Real Users:**
   - Create actual discussions
   - Monitor Edge Function performance
   - Tune AI prompts as needed

---

## 🆘 Getting Help

- **Documentation:** `DATABASE_ORCHESTRATED_SYSTEM.md`
- **Edge Function Code:** `supabase/functions/turn-controller/index.ts`
- **SQL Functions:** `supabase/migrations/20260215171000_*`
- **Schema:** `supabase/migrations/20260215170000_*`

---

## ✅ Success Criteria

Your system is working when:

1. ✅ User inserts message → Agents respond automatically
2. ✅ Works even with browser closed
3. ✅ Conversation continues until user's turn
4. ✅ All messages logged with proper turn_index
5. ✅ No manual triggering needed

**Congratulations! You now have an indestructible, database-orchestrated multi-agent system!** 🎉
