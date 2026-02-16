# Quick Answer: Which Database?

## The Answer

**Zasterix uses Supabase**, which is built on **PostgreSQL**.

---

## Key Facts

### Platform
- **Database**: Supabase
- **Engine**: PostgreSQL 15+
- **Client**: @supabase/supabase-js v2.95.3
- **Language**: TypeScript with full type safety

### Why Supabase?

✅ **PostgreSQL-based** - Industry-standard relational database
✅ **Built-in Features** - Authentication, real-time, storage, REST API
✅ **Row Level Security (RLS)** - Multi-tenancy and security enforcement
✅ **Type Generation** - Automatic TypeScript types from schema
✅ **Real-time Subscriptions** - Live updates via WebSocket
✅ **Managed Service** - No server management required

---

## Location in Codebase

### Connection
```
lib/supabase.ts          - Client initialization
src/core/supabase.ts     - Alternative client
```

### Types
```
src/core/types/database.types.ts  - Generated TypeScript types
```

### Migrations
```
supabase/migrations/     - 20+ SQL migration files
```

### Configuration
```
.env                     - Environment variables
  ├── NEXT_PUBLIC_SUPABASE_URL
  ├── NEXT_PUBLIC_SUPABASE_ANON_KEY
  └── SUPABASE_SERVICE_ROLE_KEY
```

---

## Main Tables

1. **projects** - Project containers for discussions
2. **discussion_state** - Turn-taking state management
3. **discussion_participants** - Speaker order configuration
4. **discussion_logs** - Complete message history
5. **agent_templates** - AI agent configurations
6. **agent_blueprints** - Reusable agent templates
7. **organizations** - Multi-tenancy support
8. **universal_history** - Global conversation log

---

## Connection Example

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/core/types/database.types";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Query example
const { data: projects } = await supabase
  .from('projects')
  .select('*')
  .eq('status', 'active');
```

---

## For More Details

See **[DATABASE.md](./DATABASE.md)** for comprehensive documentation including:
- Complete schema reference
- Migration management
- RLS policies
- Performance optimization
- Troubleshooting guide
- Query examples

---

## Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables in .env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 3. Apply migrations
supabase db push

# 4. Run development server
npm run dev
```

---

## Summary

**Database**: Supabase (PostgreSQL)  
**Documentation**: [DATABASE.md](./DATABASE.md)  
**Migrations**: `supabase/migrations/`  
**Types**: `src/core/types/database.types.ts`  

That's it! 🎉
