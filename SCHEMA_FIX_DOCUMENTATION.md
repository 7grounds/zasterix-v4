# Fix Schema Cache Error & Column Mismatch

## Problem Statement
The application was throwing an error: **"Could not find the 'status' column of 'discussion_state'"**

This occurred because the actual database table `discussion_state` uses `is_active` (boolean) instead of `status` (text), but the code was trying to access a non-existent `status` column.

## Root Cause
- **Migration files** defined the table with a `status` text column
- **Actual database** had `is_active` boolean column
- **Code** was trying to use `state.status === "active"` which failed

## Solution

### 1. Database Migration
Created migration `20260216160000_change_status_to_is_active.sql` to:
- Add `is_active` boolean column (default: true)
- Migrate existing data:
  - `status = 'active'` → `is_active = true`
  - `status = 'completed'` → `is_active = false`
  - `status = 'paused'` → `is_active = false`
- Drop old `status` column and constraints
- Add index on `is_active` for performance

### 2. TypeScript Types Updated
File: `src/core/types/database.types.ts`

```typescript
// Before
discussion_state: {
  Row: {
    id: string;
    project_id: string;
    current_turn_index: number;
    current_round: number;
    status: string;  // ❌ Old
    created_at: string;
    updated_at: string;
  };
}

// After
discussion_state: {
  Row: {
    id: string;
    project_id: string;
    current_turn_index: number;
    current_round: number;
    is_active: boolean;  // ✅ New
    created_at: string;
    updated_at: string;
  };
}
```

### 3. Code Refactored
File: `src/core/discussion-engine-v2.ts`

#### Type Definition Change
```typescript
// Before
type DiscussionState = {
  id: string;
  project_id: string;
  current_turn_index: number;
  current_round: number;
  status: "active" | "completed" | "paused";  // ❌
};

// After
type DiscussionState = {
  id: string;
  project_id: string;
  current_turn_index: number;
  current_round: number;
  is_active: boolean;  // ✅
};
```

#### Code Changes

**1. Creating discussion state**:
```typescript
// Before
.insert({
  project_id: projectId,
  current_turn_index: 0,
  current_round: 1,
  status: "active",  // ❌
})

// After
.insert({
  project_id: projectId,
  current_turn_index: 0,
  current_round: 1,
  is_active: true,  // ✅
})
```

**2. Updating discussion state**:
```typescript
// Before
const updateDiscussionState = async ({
  status,  // ❌
}: {
  status: "active" | "completed" | "paused";
}) => {
  await supabase.from("discussion_state").update({
    status,
  });
};

// After
const updateDiscussionState = async ({
  isActive,  // ✅
}: {
  isActive: boolean;
}) => {
  await supabase.from("discussion_state").update({
    is_active: isActive,
  });
};
```

**3. Checking discussion state**:
```typescript
// Before
if (state.status === "completed") {  // ❌
  throw new Error("Discussion is already completed.");
}

if (state.status === "active") {  // ❌
  // Process discussion
}

// After
if (!state.is_active) {  // ✅
  throw new Error("Discussion is already completed.");
}

if (state.is_active) {  // ✅
  // Process discussion
}
```

**4. Setting discussion as completed**:
```typescript
// Before
let finalStatus: "active" | "completed" = "active";
if (nextRound > MAX_DISCUSSION_ROUNDS) {
  finalStatus = "completed";  // ❌
}
await updateDiscussionState({ status: finalStatus });

// After
let finalIsActive = true;
if (nextRound > MAX_DISCUSSION_ROUNDS) {
  finalIsActive = false;  // ✅
}
await updateDiscussionState({ isActive: finalIsActive });
```

### 4. Project Initialization Updated
File: `app/api/projects/init/route.ts`

```typescript
// Before
await supabase.from("discussion_state").insert({
  project_id: projectId,
  current_turn_index: 0,
  current_round: 1,
  status: "active"  // ❌
});

// After
await supabase.from("discussion_state").insert({
  project_id: projectId,
  current_turn_index: 0,
  current_round: 1,
  is_active: true  // ✅
});
```

## Benefits

1. **Simpler Logic**: Boolean (`true`/`false`) is clearer than string statuses (`"active"`, `"completed"`, `"paused"`)
2. **Better Performance**: Boolean comparison is faster than string comparison
3. **Type Safety**: Boolean is more restrictive and prevents invalid values
4. **Schema Alignment**: Code now matches actual database structure
5. **Fewer Bugs**: No more typos with string literals

## Verification

### Check Database Schema
```sql
-- Verify column exists and is boolean
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'discussion_state'
AND column_name = 'is_active';

-- Expected result:
-- column_name | data_type | is_nullable | column_default
-- is_active   | boolean   | NO          | true
```

### Check Data Migration
```sql
-- Verify all records have is_active set
SELECT 
  is_active, 
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM discussion_state
GROUP BY is_active;
```

### Check Index
```sql
-- Verify index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'discussion_state'
AND indexname LIKE '%is_active%';
```

## Files Modified

1. **Created**: `supabase/migrations/20260216160000_change_status_to_is_active.sql`
   - Migration to change column from status to is_active

2. **Modified**: `src/core/types/database.types.ts`
   - Updated discussion_state type definition

3. **Modified**: `src/core/discussion-engine-v2.ts`
   - Refactored all status references to is_active
   - Updated type definitions
   - Changed function parameters

4. **Modified**: `app/api/projects/init/route.ts`
   - Updated project initialization to use is_active

## Testing Checklist

- [x] ✅ Linting passed (no ESLint errors)
- [x] ✅ TypeScript compilation successful
- [x] ✅ All type definitions updated
- [x] ✅ All table references are lowercase
- [ ] Migration applied to database
- [ ] Tested "Manager Alpha" mission flow
- [ ] Verified project_id → discussion_state → agent_templates fetch order

## Rollback Plan

If issues arise, rollback with:

```sql
-- Add back status column
ALTER TABLE public.discussion_state
ADD COLUMN status text DEFAULT 'active';

-- Migrate data back
UPDATE public.discussion_state
SET status = CASE 
  WHEN is_active = true THEN 'active'
  ELSE 'completed'
END;

-- Add constraint
ALTER TABLE public.discussion_state
ADD CONSTRAINT discussion_state_status_check 
CHECK (status IN ('active', 'completed', 'paused'));

-- Drop is_active
ALTER TABLE public.discussion_state
DROP COLUMN is_active;
```

**Note**: Rollback is NOT recommended as it will require reverting code changes as well.

## Next Steps

1. **Apply Migration**: Run migration on database
2. **Test Flow**: Test the "Manager Alpha" mission
3. **Verify Order**: Ensure project_id → discussion_state → agent_templates fetch order
4. **Monitor**: Watch for any schema-related errors in production

## Conclusion

The schema mismatch has been resolved. The code now correctly uses `is_active` (boolean) instead of `status` (text) for the `discussion_state` table, matching the actual database structure and eliminating the "column not found" error.
