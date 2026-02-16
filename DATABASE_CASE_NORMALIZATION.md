# Database Case Normalization Guide

## Overview
This guide documents the database case normalization implementation to ensure case-insensitive operations and prevent syntax errors due to case-sensitivity.

## Problem
Case-sensitivity issues were causing:
- Query failures when searching with different cases
- Inconsistent data matching in "Agent Picker" logic
- Syntax errors in database operations

## Solution
Normalized all database data to lowercase while maintaining schema integrity.

## Implementation

### 1. Database Schema ✅
**Status**: Already lowercase compliant

The database schema already uses lowercase naming:
- Tables: `agent_templates`, `agent_blueprints`, `projects`, `discussion_participants`, etc.
- Columns: `trigger_keywords`, `discipline`, `engine_type`, `code_name`, etc.

**No ALTER TABLE statements needed for schema.**

### 2. Data Normalization

**Migration File**: `supabase/migrations/20260216123800_normalize_data_to_lowercase.sql`

This migration normalizes all data values to lowercase:

#### agent_templates Table
- `discipline` column → lowercase (e.g., 'Frontend_Design' → 'frontend_design')
- `category` column → lowercase (e.g., 'Tourism' → 'tourism')
- `engine_type` column → lowercase (e.g., 'Manager_Logic' → 'manager_logic')
- `provider` column → lowercase (e.g., 'Groq' → 'groq')
- `trigger_keywords` array → all elements to lowercase
- `search_keywords` array → all elements to lowercase

#### projects Table
- `status` column → lowercase (e.g., 'Active' → 'active')
- `type` column → lowercase (e.g., 'Discussion' → 'discussion')

#### discussion_participants Table
- `role` column → lowercase (e.g., 'Manager' → 'manager')

#### discussion_state Table
- `status` column → lowercase (e.g., 'Active' → 'active')

#### discussion_logs Table
- `role` column → lowercase

### 3. Performance Optimization

Added case-insensitive indices for better query performance:
```sql
CREATE INDEX idx_agent_templates_discipline_lower ON agent_templates (LOWER(discipline));
CREATE INDEX idx_agent_templates_category_lower ON agent_templates (LOWER(category));
CREATE INDEX idx_agent_templates_engine_type_lower ON agent_templates (LOWER(engine_type));
CREATE INDEX idx_projects_status_lower ON projects (LOWER(status));
CREATE INDEX idx_projects_type_lower ON projects (LOWER(type));
```

### 4. Constraint Updates

Updated CHECK constraints to enforce lowercase values:
```sql
-- discussion_participants
CHECK (role IN ('manager', 'leader', 'user', 'specialist'))

-- discussion_state
CHECK (status IN ('active', 'completed', 'paused'))

-- discussion_logs
CHECK (role IN ('manager', 'leader', 'user', 'specialist'))
```

### 5. Code Updates

#### Query Utilities (`lib/query-utils.ts`)
Created helper functions for case-insensitive queries:

```typescript
import { normalizeForQuery, normalizeArrayForQuery } from '@/lib/query-utils';

// Single value
const category = normalizeForQuery(userInput);
await supabase.from('agent_templates').select('*').eq('category', category);

// Array of values
const names = normalizeArrayForQuery(['Manager L3', 'Hotel Expert L2']);
await supabase.from('agent_templates').select('*').in('name', names);
```

#### Updated Files
1. `scripts/bulk-tag-agents.js` - Uses lowercase 'tourism' category
2. `supabase/migrations/20260216121800_bulk_agent_metadata_standardization.sql` - Updated to use lowercase

## Usage Guidelines

### For Developers

**1. Always normalize user input before queries:**
```typescript
// ❌ Bad - Case-sensitive
const { data } = await supabase
  .from('agent_templates')
  .select('*')
  .eq('discipline', userInput); // May fail if case doesn't match

// ✅ Good - Case-insensitive
import { normalizeForQuery } from '@/lib/query-utils';
const { data } = await supabase
  .from('agent_templates')
  .select('*')
  .eq('discipline', normalizeForQuery(userInput));
```

**2. Use helper functions for array queries:**
```typescript
import { normalizeArrayForQuery } from '@/lib/query-utils';

const agentNames = ['Manager L3', 'Hotel Expert L2'];
const { data } = await supabase
  .from('agent_templates')
  .select('*')
  .in('name', normalizeArrayForQuery(agentNames));
```

**3. When inserting data, use lowercase:**
```typescript
await supabase.from('agent_templates').insert({
  name: 'My Agent',
  discipline: 'frontend_design',  // lowercase
  category: 'tourism',             // lowercase
  engine_type: 'manager_logic',    // lowercase
  trigger_keywords: ['design', 'ui', 'ux']  // lowercase array
});
```

### For Database Operations

**1. All new data should be lowercase:**
```sql
INSERT INTO agent_templates (discipline, category, engine_type)
VALUES ('frontend_design', 'tourism', 'manager_logic');
```

**2. Use ILIKE for pattern matching:**
```sql
-- Case-insensitive search
SELECT * FROM agent_templates
WHERE name ILIKE '%design%' OR description ILIKE '%design%';
```

**3. Use lowercase in WHERE clauses:**
```sql
-- Filter by lowercase values
SELECT * FROM agent_templates
WHERE discipline = 'frontend_design'
AND category = 'tourism';
```

## Migration Execution

### Running the Migration

**Option 1: Supabase CLI**
```bash
supabase db push
```

**Option 2: Direct SQL**
```bash
psql $DATABASE_URL -f supabase/migrations/20260216123800_normalize_data_to_lowercase.sql
```

### Verification Queries

**1. Check all values are lowercase:**
```sql
-- Should return 0 rows (all values are lowercase)
SELECT COUNT(*) FROM agent_templates
WHERE discipline != LOWER(discipline)
   OR category != LOWER(category)
   OR engine_type != LOWER(engine_type);
```

**2. Verify constraint enforcement:**
```sql
-- Should fail with constraint violation
INSERT INTO discussion_participants (role) VALUES ('Manager');
-- Error: violates check constraint

-- Should succeed
INSERT INTO discussion_participants (role) VALUES ('manager');
```

**3. Check indices exist:**
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'agent_templates'
AND indexname LIKE '%_lower';
```

## Benefits

1. **Case-Insensitive Queries**: Users can search with any case
2. **Consistent Data**: All data follows the same lowercase convention
3. **Better Performance**: Lowercase indices improve query speed
4. **Fewer Errors**: Constraint enforcement prevents mixed-case data
5. **Maintainability**: Clear convention for all developers

## Rollback Plan

If issues arise, you can revert data (not recommended):

```sql
-- Revert to mixed case (ONLY if absolutely necessary)
UPDATE agent_templates
SET 
  discipline = INITCAP(discipline),
  category = INITCAP(category),
  engine_type = INITCAP(engine_type);

-- Remove lowercase constraints
ALTER TABLE discussion_participants DROP CONSTRAINT discussion_participants_role_check;
ALTER TABLE discussion_state DROP CONSTRAINT discussion_state_status_check;
ALTER TABLE discussion_logs DROP CONSTRAINT discussion_logs_role_check;
```

**Note**: Rollback is NOT recommended as it will reintroduce case-sensitivity issues.

## Testing

### Test Cases

1. **Case-Insensitive Search**:
```typescript
// Should find agents regardless of input case
const tests = ['tourism', 'Tourism', 'TOURISM', 'ToUrIsM'];
for (const input of tests) {
  const { data } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('category', normalizeForQuery(input));
  
  console.assert(data.length > 0, `Failed for input: ${input}`);
}
```

2. **Array Matching**:
```typescript
const names = ['Manager L3', 'HOTEL EXPERT L2', 'guide expert l2'];
const normalized = normalizeArrayForQuery(names);
const { data } = await supabase
  .from('agent_templates')
  .select('*')
  .in('name', normalized);

console.assert(data.length === names.length, 'Array matching failed');
```

3. **Constraint Enforcement**:
```sql
-- Should fail
INSERT INTO discussion_participants (role) VALUES ('Manager');

-- Should succeed
INSERT INTO discussion_participants (role) VALUES ('manager');
```

## Common Patterns

### Search/Filter Components
```typescript
function AgentSearch({ category }: { category?: string }) {
  const [agents, setAgents] = useState([]);
  
  useEffect(() => {
    const fetchAgents = async () => {
      let query = supabase.from('agent_templates').select('*');
      
      if (category) {
        // Always normalize user input
        query = query.eq('category', normalizeForQuery(category));
      }
      
      const { data } = await query;
      setAgents(data || []);
    };
    
    fetchAgents();
  }, [category]);
  
  return <AgentList agents={agents} />;
}
```

### Dynamic Filtering
```typescript
function filterAgents(
  filters: {
    discipline?: string;
    category?: string;
    engineType?: string;
  }
) {
  let query = supabase.from('agent_templates').select('*');
  
  if (filters.discipline) {
    query = query.eq('discipline', normalizeForQuery(filters.discipline));
  }
  
  if (filters.category) {
    query = query.eq('category', normalizeForQuery(filters.category));
  }
  
  if (filters.engineType) {
    query = query.eq('engine_type', normalizeForQuery(filters.engineType));
  }
  
  return query;
}
```

## Summary

✅ **Schema**: Already lowercase - no changes needed  
✅ **Data**: Normalized to lowercase via migration  
✅ **Indices**: Added for performance  
✅ **Constraints**: Updated to enforce lowercase  
✅ **Code**: Helper utilities created  
✅ **Documentation**: Complete guide provided  

All database operations now use consistent lowercase values, eliminating case-sensitivity issues and ensuring reliable "Agent Picker" logic.
