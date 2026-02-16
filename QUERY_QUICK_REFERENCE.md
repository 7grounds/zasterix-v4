# Quick Reference: Case-Insensitive Database Queries

## TL;DR
Always normalize user input to lowercase before database queries to ensure consistent results.

## Import the utilities
```typescript
import { normalizeForQuery, normalizeArrayForQuery } from '@/lib/query-utils';
```

## Common Patterns

### 1. Single Value Queries
```typescript
// User input
const userCategory = 'Tourism'; // Could be any case

// Query
const { data } = await supabase
  .from('agent_templates')
  .select('*')
  .eq('category', normalizeForQuery(userCategory)); // Always works!
```

### 2. Multiple Values (IN queries)
```typescript
// User input
const agentNames = ['Manager L3', 'HOTEL EXPERT L2', 'guide expert l2'];

// Query
const { data } = await supabase
  .from('agent_templates')
  .select('*')
  .in('name', normalizeArrayForQuery(agentNames)); // Normalizes all to lowercase
```

### 3. Search/Filter Components
```typescript
function AgentFilter({ discipline, category }: FilterProps) {
  const [agents, setAgents] = useState([]);
  
  useEffect(() => {
    const fetchAgents = async () => {
      let query = supabase.from('agent_templates').select('*');
      
      // Always normalize filters
      if (discipline) {
        query = query.eq('discipline', normalizeForQuery(discipline));
      }
      
      if (category) {
        query = query.eq('category', normalizeForQuery(category));
      }
      
      const { data } = await query;
      setAgents(data || []);
    };
    
    fetchAgents();
  }, [discipline, category]);
  
  return <AgentList agents={agents} />;
}
```

### 4. Dynamic Filtering
```typescript
async function filterAgents(filters: {
  discipline?: string;
  category?: string;
  engineType?: string;
}) {
  let query = supabase.from('agent_templates').select('*');
  
  // Normalize each filter
  if (filters.discipline) {
    query = query.eq('discipline', normalizeForQuery(filters.discipline));
  }
  
  if (filters.category) {
    query = query.eq('category', normalizeForQuery(filters.category));
  }
  
  if (filters.engineType) {
    query = query.eq('engine_type', normalizeForQuery(filters.engineType));
  }
  
  return await query;
}
```

### 5. Inserting Data
```typescript
// Always use lowercase for new data
await supabase.from('agent_templates').insert({
  name: 'My Agent',
  discipline: 'frontend_design',  // lowercase
  category: 'tourism',             // lowercase
  engine_type: 'manager_logic',    // lowercase
  trigger_keywords: ['design', 'ui', 'ux']  // all lowercase
});
```

## Affected Columns

Always normalize queries for these columns:

### agent_templates
- `discipline` (e.g., 'frontend_design', 'infrastructure')
- `category` (e.g., 'tourism', 'education')
- `engine_type` (e.g., 'manager_logic')
- `provider` (e.g., 'groq', 'openai')
- `trigger_keywords` (array)
- `search_keywords` (array)

### projects
- `status` (e.g., 'active', 'completed')
- `type` (e.g., 'discussion', 'course')

### discussion_participants, discussion_logs
- `role` (e.g., 'manager', 'user', 'specialist')

### discussion_state
- `status` (e.g., 'active', 'completed', 'paused')

## What's Already Done

✅ Migration normalizes all existing data to lowercase  
✅ Indices created for fast case-insensitive queries  
✅ Constraints enforce lowercase on new data  
✅ Utility functions available for easy normalization  

## Testing Your Code

```typescript
// Test with different cases
const testCases = ['tourism', 'Tourism', 'TOURISM', 'ToUrIsM'];

for (const testCase of testCases) {
  const { data, error } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('category', normalizeForQuery(testCase));
  
  console.assert(data && data.length > 0, `Failed for: ${testCase}`);
}
```

## Remember

1. **Always** import and use `normalizeForQuery()` for single values
2. **Always** import and use `normalizeArrayForQuery()` for arrays
3. **Never** hardcode uppercase values in INSERT statements
4. **Use** ILIKE for pattern matching in SQL
5. **Test** with mixed-case inputs to ensure queries work

## Need Help?

See full documentation in `DATABASE_CASE_NORMALIZATION.md`
