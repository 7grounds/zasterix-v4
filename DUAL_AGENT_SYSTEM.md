# Dual-Agent System: Code Architect & Quality Expert

## Overview

The Zasterix system now includes a **Dual-Agent System** for code development, consisting of:

1. **Code Architect (L3)** - Strategic design layer
2. **Quality Expert (L2)** - Validation layer

This system ensures code quality while maintaining Origo Architecture principles: minimalism, data-centricity, and user control.

---

## Agent Hierarchy

```
Level 4: Manager Alpha (Coordinator)
  ↓
Level 3: Code Architect (Strategic Design)
  ↓
Level 3: Discussion Leader (Meeting Moderation)
  ↓
Level 3: Manager L3 (Decision Making)
  ↓
Level 2: Quality Expert (Code Validation)
  ↓
Level 2: Domain Specialists (Hotel, Tourism, Guide, etc.)
```

---

## Code Architect (L3)

### Role
Strategic code design agent that plans structure before implementation.

### Responsibilities
1. **Analyze**: Review requirements and existing code patterns
2. **Design**: Create minimal, data-centric solutions
3. **Document**: Provide max 3 lines of explanation per section
4. **Validate**: Ensure compliance with Origo Architecture
5. **Audit**: Confirm all DB operations log to universal_history

### System Prompt
```
You are the Code Architect (L3) in the Zasterix system.

ROLE: Design code structure before implementation begins.

PRINCIPLES:
1. Minimalism: Avoid code bloat. Direct database access over abstractions.
2. Data-Centric: Logic flows from database state. Use existing JSONB columns.
3. Schema-First: Always reference actual database schema from migrations.

WORKFLOW:
1. Analyze requirements and existing code patterns.
2. Design minimal solution using Supabase direct queries.
3. Propose structure with max 3 lines of explanation per section.
4. Ensure all DB operations log to universal_history.
5. Validate against Origo Architecture principles.
```

### Example Usage

**User Request**: "Create API route to verify tasks"

**Code Architect Response**:
```
[Code Architect]: Task verification requires direct DB update with audit logging.
Route: /app/api/tasks/verify/route.ts
Implementation: Update universal_history payload status, log operation.

[Quality Check Required]:
- TypeScript type for payload
- Error handling for missing task
- RLS policy validation
```

---

## Quality Expert (L2)

### Role
Code validation specialist that ensures production readiness after Architect designs.

### Validation Checklist

#### 1. TypeScript Compliance
- ✓ All types are explicit (no `any`)
- ✓ Proper error handling with structured responses
- ✓ Type guards for database responses

#### 2. Database Operations
- ✓ Every mutation logs to `universal_history`
- ✓ Audit trail includes: user_id, organization_id, operation type
- ✓ Proper use of JSONB payloads

#### 3. Origo Architecture Compliance
- ✓ Direct queries, no service layers
- ✓ Minimal code, no unnecessary abstractions
- ✓ Uses existing tables and JSONB columns

#### 4. Testing & Error Handling
- ✓ Edge cases handled (null checks, empty arrays)
- ✓ Error responses follow standard format
- ✓ Validation before DB operations

#### 5. Security
- ✓ RLS policies respected
- ✓ User context validated
- ✓ Organization boundaries enforced

#### 6. Agent Response Rules
- ✓ Max 3 lines per explanation (Manager Alpha Rule)
- ✓ Clear, concise language
- ✓ English only (no German in DB)

### System Prompt
```
You are the Quality Expert (L2) in the Zasterix system.

ROLE: Validate code for production readiness after Architect designs.

VALIDATION CHECKLIST:
1. TypeScript: All types explicit, no 'any', proper error handling.
2. Database: Every mutation logs to universal_history for audit.
3. Origo Compliance: Minimal code, direct queries, no unnecessary abstractions.
4. Testing: Edge cases handled, error responses structured.
5. Security: RLS policies respected, user context validated.
```

### Example Validation

**Input**: Code Architect's task verification route

**Quality Expert Response**:
```
[Quality Expert]: Validation complete for task verification route.

✓ Passed:
- TypeScript types explicit for TaskPayload
- universal_history logging implemented
- Error handling with structured response

⚠ Issues:
- Line 15: Add null check before payload.status access
- Line 23: Type organizationId explicitly as string | null

✗ Blocked: None
```

---

## Workflow Integration

### Standard Development Flow

```
1. User Request
   ↓
2. Manager Alpha delegates to Code Architect
   ↓
3. Code Architect designs solution
   ↓
4. Quality Expert validates design
   ↓
5. If issues: Back to Code Architect
   If passed: Implementation approved
   ↓
6. Code implemented
   ↓
7. Quality Expert final review
   ↓
8. Merge to main branch
```

### Example: Building Task Verification API

**Step 1: User Request**
```
"I need to verify completed tasks and log the action for audit purposes"
```

**Step 2: Code Architect Design**
```typescript
/**
 * @MODULE_ID app.api.tasks.verify
 * @STAGE tasks
 * @DATA_INPUTS ["task_id", "user_id", "organization_id"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */

// Route: /app/api/tasks/verify/route.ts
// Updates task status in universal_history and logs verification

export async function POST(req: Request) {
  const { taskId, userId, organizationId } = await req.json();
  
  // Update task payload with verified status
  const { data, error } = await supabase
    .from('universal_history')
    .update({ 
      payload: { ...existingPayload, status: 'verified', verified_at: new Date().toISOString() }
    })
    .eq('id', taskId)
    .select()
    .single();
    
  // Log verification action
  await supabase.from('universal_history').insert({
    user_id: userId,
    organization_id: organizationId,
    payload: { 
      type: 'task_verification',
      task_id: taskId,
      verified_by: userId,
      timestamp: new Date().toISOString()
    }
  });
  
  return Response.json({ success: true, data });
}
```

**Step 3: Quality Expert Validation**
```
[Quality Expert]: Initial review - blocking issues found.

✓ Passed:
- universal_history logging implemented
- Direct Supabase queries (no abstraction)
- Audit trail with user context

⚠ Issues:
- Line 12: existingPayload undefined - fetch before update
- Line 15: Add error handling for update operation
- Line 22: Validate taskId format (UUID) before query

✗ Blocked:
- Missing TypeScript types for request body
- No error response structure
```

**Step 4: Code Architect Revision**
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type VerifyTaskRequest = {
  taskId: string;
  userId: string;
  organizationId: string | null;
};

export async function POST(req: Request) {
  const supabase = createClient(/* ... */);
  const body = await req.json() as VerifyTaskRequest;
  
  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.taskId)) {
    return NextResponse.json({ error: 'Invalid task ID format' }, { status: 400 });
  }
  
  // Fetch existing task
  const { data: existing, error: fetchError } = await supabase
    .from('universal_history')
    .select('payload')
    .eq('id', body.taskId)
    .single();
    
  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  
  // Update with verified status
  const { data, error: updateError } = await supabase
    .from('universal_history')
    .update({ 
      payload: { 
        ...(existing.payload as Record<string, unknown>),
        status: 'verified',
        verified_at: new Date().toISOString()
      }
    })
    .eq('id', body.taskId)
    .select()
    .single();
    
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  
  // Log verification action
  await supabase.from('universal_history').insert({
    user_id: body.userId,
    organization_id: body.organizationId,
    payload: { 
      type: 'task_verification',
      task_id: body.taskId,
      verified_by: body.userId,
      timestamp: new Date().toISOString()
    }
  });
  
  return NextResponse.json({ success: true, data });
}
```

**Step 5: Quality Expert Final Validation**
```
[Quality Expert]: Final validation passed - ready for merge.

✓ Passed:
- TypeScript types complete (VerifyTaskRequest)
- UUID validation before DB query
- Fetch-before-update pattern implemented
- Error handling with structured responses (400, 404, 500)
- universal_history logging with user context
- Type casting for payload with unknown
- No code bloat, direct queries

⚠ Issues: None

✗ Blocked: None

[Approval]: Code ready for production deployment.
```

---

## Usage in Cursor/Copilot

### Cursor (.cursorrules)

The `.cursorrules` file now includes:
```
🚀 DUAL-AGENT SYSTEM: Code Architect (L3) & Quality Expert (L2)

Act as a Dual-Agent System specialized in the Origo Architecture.
Organization ID: 17b2f0fe-f89d-47b1-9fd4-aafe1a327388

## THE ARCHITECT (L3 - Strategic Layer)
[Design principles and workflow]

## THE QUALITY EXPERT (L2 - Validation Layer)
[Validation checklist and standards]
```

### GitHub Copilot (.github/copilot-instructions.md)

Enhanced with dual-agent system at the top:
```markdown
## 🚀 DUAL-AGENT SYSTEM: Code Architect (L3) & Quality Expert (L2)

You operate as a **Dual-Agent System** specialized in the Origo Architecture.

[Full instructions for both agents]
```

### Using in Development

**Simple Request**:
```
"Create a route to update task status"
```

**Copilot will respond as**:
```
[Code Architect]: Direct DB update with audit logging required.
[Implementation provided]
[Quality Check Required]: Type validation, error handling
```

**Follow-up Validation**:
```
"Quality Expert, review this code"
```

**Copilot validates as**:
```
[Quality Expert]: Validation summary
✓ Passed: [items]
⚠ Issues: [items with fixes]
```

---

## Benefits

### 1. Built-in Quality Assurance
Every code design gets automatic validation before implementation.

### 2. Origo Compliance
Both agents enforce minimalism and data-centricity principles.

### 3. Audit Trail
Quality Expert ensures universal_history logging on all mutations.

### 4. Type Safety
Explicit TypeScript validation catches errors early.

### 5. Consistent Patterns
Both agents follow the same architectural principles.

### 6. Educational
Developers learn best practices through validation feedback.

---

## Database Configuration

### Organization ID
```
17b2f0fe-f89d-47b1-9fd4-aafe1a327388
```

All agents are scoped to this organization in the database.

### Agent Records

**Code Architect**:
- Level: 3 (Strategic)
- Category: Development
- Icon: code
- Model: groq/llama-3.1-8b-instant

**Quality Expert**:
- Level: 2 (Validation)
- Category: Development
- Icon: shield-check
- Model: groq/llama-3.1-8b-instant

---

## English Naming Convention

All database entries use English naming:
- ✓ Tourism Expert L2 (not "Tourismus Expert")
- ✓ Code Architect (not "Code Architekt")
- ✓ Quality Expert (not "Qualitäts Experte")
- ✓ Discussion Leader (not "Diskussions Leiter")

This ensures:
- Consistent codebase
- International team collaboration
- Clear AI assistant understanding
- Better documentation

---

## Next Steps

1. **Apply Migration**: Run the SQL migration to create agents in database
2. **Test Workflow**: Try a simple code request with Copilot/Cursor
3. **Review Validation**: See how Quality Expert catches issues
4. **Refine Prompts**: Adjust based on your development patterns
5. **Document Patterns**: Build a library of validated solutions

---

## Support

Questions about the dual-agent system?
- Check Origo Architecture documentation
- Review validation examples above
- Test with simple requests first
- Iterate on feedback from Quality Expert

The system learns from your patterns and improves over time.
