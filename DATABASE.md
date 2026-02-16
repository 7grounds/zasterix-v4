# Database Documentation

## Overview

**Zasterix** uses **Supabase** as its database platform, which is built on top of **PostgreSQL**.

Supabase provides a PostgreSQL database with built-in features including:
- Row Level Security (RLS)
- Real-time subscriptions
- RESTful API
- Authentication
- Storage

## Database Platform

- **Platform**: Supabase (PostgreSQL 15+)
- **Client Library**: `@supabase/supabase-js` v2.95.3
- **Type Safety**: Full TypeScript support with generated types

## Connection

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Client Configuration

The Supabase client is initialized in `lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/core/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

## Schema Overview

### Core Tables

#### 1. **projects**
Stores project information for discussions and other workflows.

```sql
- id: uuid (PK)
- organization_id: uuid (FK → organizations)
- name: text
- type: text (default: 'discussion')
- status: text (default: 'active')
- topic_objective: text (dynamic topic for agents)
- metadata: jsonb
- current_discussion_step: integer
- created_at: timestamptz
- updated_at: timestamptz
```

**Purpose**: Main project container for multi-agent discussions.

#### 2. **discussion_state**
Tracks the current state of active discussions.

```sql
- id: uuid (PK)
- project_id: uuid (FK → projects)
- current_turn_index: integer (which participant's turn)
- current_round: integer (round number)
- is_active: boolean (whether discussion is ongoing)
- created_at: timestamptz
- updated_at: timestamptz
```

**Purpose**: Manages turn-taking logic in multi-agent discussions.

#### 3. **discussion_participants**
Defines participants in a discussion and their speaking order.

```sql
- id: uuid (PK)
- project_id: uuid (FK → projects)
- agent_id: uuid (FK → agent_templates, nullable for user role)
- role: text ('manager', 'leader', 'user', 'specialist')
- sequence_order: integer (speaking order)
- created_at: timestamptz
```

**Purpose**: Establishes the order of speakers in discussions.

#### 4. **discussion_logs**
Persists all messages in discussions.

```sql
- id: uuid (PK)
- project_id: uuid (FK → projects)
- agent_id: uuid (FK → agent_templates, nullable)
- role: text ('manager', 'leader', 'user', 'specialist')
- content: text (message content)
- turn_index: integer
- round_number: integer
- created_at: timestamptz
```

**Purpose**: Complete audit trail of all discussion messages.

#### 5. **agent_templates**
Defines AI agent configurations and capabilities.

```sql
- id: uuid (PK)
- organization_id: uuid (FK → organizations, nullable)
- name: text
- description: text
- system_prompt: text (LLM instruction)
- ai_model_config: jsonb (model settings)
- category: text (e.g., 'tourism', 'education')
- discipline: text (e.g., 'frontend_design', 'infrastructure')
- engine_type: text (e.g., 'manager_logic')
- code_name: text UNIQUE (unique identifier)
- provider: text (e.g., 'groq', 'openai')
- model_name: text (e.g., 'llama-3.1-8b-instant')
- trigger_keywords: text[] (for agent selection)
- search_keywords: text[]
- icon: text
- is_active: boolean
- created_at: timestamptz
- updated_at: timestamptz
```

**Purpose**: Agent library for intelligent selection and configuration.

#### 6. **agent_blueprints**
Reusable agent templates with validation rules.

```sql
- id: uuid (PK)
- organization_id: uuid (FK → organizations, nullable)
- name: text
- description: text
- category: text
- logic_template: jsonb (validation rules)
- spawn_metadata: jsonb (creation parameters)
- is_active: boolean
- created_at: timestamptz
- updated_at: timestamptz
```

**Purpose**: Templates for creating standardized agents.

#### 7. **organizations**
Multi-tenancy support for different organizations.

```sql
- id: uuid (PK)
- name: text
- metadata: jsonb
- created_at: timestamptz
- updated_at: timestamptz
```

**Purpose**: Isolate data between different organizations.

#### 8. **universal_history**
Global conversation history across all interactions.

```sql
- id: uuid (PK)
- user_id: text
- organization_id: uuid (FK → organizations)
- agent_template_id: uuid (FK → agent_templates)
- role: text ('user', 'assistant', 'system')
- content: text
- token_count: integer
- summary: text
- created_at: timestamptz
```

**Purpose**: Historical record of all AI interactions.

### Supporting Tables

- **user_asset_history**: Track user asset changes
- **search_logs**: Log search queries for analytics
- **user_flows**: Track user navigation patterns
- **billing_logs**: Track usage for billing purposes

## Migrations

### Location
All database migrations are stored in: `supabase/migrations/`

### Naming Convention
Migrations follow the pattern: `YYYYMMDDHHMMSS_description.sql`

Example:
```
20260216163000_add_topic_objective_field.sql
20260216162900_add_projects_rls_policies.sql
20260216160000_change_status_to_is_active.sql
```

### Recent Migrations

1. **discussion_tables.sql** - Core discussion system tables
2. **seed_discussion_participants.sql** - Initial participant data
3. **bulk_agent_metadata_standardization.sql** - Agent categorization
4. **normalize_data_to_lowercase.sql** - Case normalization
5. **change_status_to_is_active.sql** - Boolean status field
6. **add_projects_rls_policies.sql** - Row Level Security
7. **add_topic_objective_field.sql** - Dynamic topic support

### Applying Migrations

```bash
# Using Supabase CLI
supabase db push

# Or direct SQL
psql $DATABASE_URL -f supabase/migrations/[migration-file].sql
```

## Row Level Security (RLS)

RLS policies are implemented on key tables to enforce multi-tenancy:

### Projects Table Policies

1. **Service role** - Full access to all projects
2. **Authenticated users** - Read projects in their organization
3. **Authenticated users** - Insert/Update/Delete projects in their org
4. **Projects without org** - Accessible to all authenticated users

### Implementation

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_projects" ON projects
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "users_select_org_projects" ON projects
FOR SELECT USING (
  organization_id IS NULL OR
  organization_id = (auth.jwt() ->> 'organization_id')::uuid
);
```

## Type Generation

TypeScript types are automatically generated from the database schema and stored in:
`src/core/types/database.types.ts`

### Usage

```typescript
import type { Database } from '@/src/core/types/database.types';

type Project = Database['public']['Tables']['projects']['Row'];
type NewProject = Database['public']['Tables']['projects']['Insert'];
```

## Data Normalization

### Lowercase Convention

All text fields that are used in queries are stored in lowercase for consistency:

- `agent_templates.discipline` → lowercase
- `agent_templates.category` → lowercase
- `projects.status` → lowercase
- `projects.type` → lowercase

### Query Utilities

Helper functions in `lib/query-utils.ts` ensure case-insensitive operations:

```typescript
import { normalizeForQuery } from '@/lib/query-utils';

const category = normalizeForQuery('Tourism'); // Returns 'tourism'
```

## Indexes

Performance indexes are created on frequently queried columns:

```sql
-- Projects
CREATE INDEX idx_projects_org_type_status ON projects(organization_id, type, status);

-- Agent Templates
CREATE INDEX idx_agent_templates_discipline_lower ON agent_templates(LOWER(discipline));
CREATE INDEX idx_agent_templates_category_lower ON agent_templates(LOWER(category));

-- Discussion Tables
CREATE INDEX idx_discussion_state_project_id ON discussion_state(project_id);
CREATE INDEX idx_discussion_logs_project_id ON discussion_logs(project_id);
CREATE INDEX idx_discussion_participants_project_id ON discussion_participants(project_id);
```

## Querying Examples

### Fetch Project with Discussion State

```typescript
const { data: project } = await supabase
  .from('projects')
  .select(`
    *,
    discussion_state(*),
    discussion_participants(*)
  `)
  .eq('id', projectId)
  .single();
```

### Load Discussion History

```typescript
const { data: logs } = await supabase
  .from('discussion_logs')
  .select(`
    *,
    agent_templates(name, description)
  `)
  .eq('project_id', projectId)
  .order('round_number', { ascending: true })
  .order('turn_index', { ascending: true });
```

### Find Agents by Category

```typescript
import { normalizeForQuery } from '@/lib/query-utils';

const { data: agents } = await supabase
  .from('agent_templates')
  .select('*')
  .eq('category', normalizeForQuery('Tourism'))
  .eq('is_active', true);
```

## Backup and Recovery

### Automated Backups
Supabase automatically creates daily backups of your database.

### Manual Backup

```bash
# Using Supabase CLI
supabase db dump -f backup.sql

# Or pg_dump directly
pg_dump $DATABASE_URL > backup.sql
```

### Restore

```bash
# Using psql
psql $DATABASE_URL < backup.sql
```

## Performance Considerations

### Connection Pooling
Supabase uses PgBouncer for connection pooling, providing up to 200 connections by default.

### Query Optimization
- Use indexes on frequently queried columns
- Avoid SELECT * in production code
- Use `.select('specific,columns')` instead
- Leverage RLS for security and query optimization

### Real-time Subscriptions
Supabase supports real-time subscriptions for live updates:

```typescript
const subscription = supabase
  .channel('discussion-logs')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'discussion_logs',
      filter: `project_id=eq.${projectId}`
    },
    (payload) => {
      console.log('New message:', payload.new);
    }
  )
  .subscribe();
```

## Troubleshooting

### Common Issues

#### 1. "Could not find column"
**Cause**: Schema cache needs refresh or migration not applied
**Solution**: Apply latest migrations or restart Supabase client

#### 2. RLS Policy Blocking Query
**Cause**: User doesn't have permission via RLS policies
**Solution**: Check RLS policies or use service role for backend operations

#### 3. UUID Format Invalid
**Cause**: Improper UUID formatting
**Solution**: Validate UUIDs with regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`

### Debug Queries

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'projects';

-- Verify table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'projects';
```

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## Support

For database-related issues:
1. Check migration files in `supabase/migrations/`
2. Review type definitions in `src/core/types/database.types.ts`
3. Consult query utilities in `lib/query-utils.ts`
4. See related documentation files:
   - `DATABASE_CASE_NORMALIZATION.md`
   - `DISCUSSION_REFACTORING.md`
   - `PROJECT_INITIALIZATION_FIX.md`
