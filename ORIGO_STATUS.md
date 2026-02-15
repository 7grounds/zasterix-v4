# Origo Architecture - Implementation Status & Next Steps

## ✅ Phase 1 Complete: Foundation & Documentation

### What's Been Created:

#### 1. GitHub Copilot Instructions (`.github/copilot-instructions.md`)
A comprehensive guide for GitHub Copilot that enforces:
- ✅ **Minimalism**: No code bloat
- ✅ **Data-Centric**: Database-first approach
- ✅ **Agent Hierarchy**: Respect L2-L4 levels
- ✅ **No New Tables**: Use JSONB for extensibility
- ✅ **Agent Memory**: Keywords in blueprints
- ✅ **User Confirmation**: Required for all actions

#### 2. System Documentation (`ORIGO_ARCHITECTURE.md`)
Complete architectural documentation with:
- ✅ Core principles explained
- ✅ Agent hierarchy diagrams
- ✅ Data flow visualizations
- ✅ Task extraction workflow
- ✅ Code examples (good vs bad)
- ✅ Implementation guidelines

---

## 🎯 Current System Capabilities

### Existing Features:
1. **Multi-Agent Discussions** ✅
   - Manager Alpha coordinates
   - Discussion Leader moderates
   - L2 specialists contribute
   - Summaries generated

2. **Meeting Viewer** ✅
   - View completed discussions
   - Summaries prominently displayed
   - Full transcripts available

3. **Agent Templates** ✅
   - Hierarchical agent structure
   - Blueprint-based inheritance
   - AI model configuration

4. **Database Structure** ✅
   - agent_templates
   - agent_blueprints (with JSONB logic_template)
   - projects
   - discussion_logs
   - universal_history

---

## 🔮 What We're Building: Closed-Loop MAS

### Vision:
Create a self-improving multi-agent system where agents can:
1. **Analyze** the codebase for improvements
2. **Propose** tasks based on analysis
3. **Wait** for user confirmation
4. **Execute** approved tasks
5. **Report** results
6. **Learn** from each iteration (keywords in blueprints)

### The Closed Loop:

```
┌─────────────────────────────────────────────────────┐
│                    USER                             │
│  "Improve our API routes for consistency"          │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│              Manager Alpha (L4)                     │
│  Recognizes coding improvement request              │
│  Delegates to Code Improvement Agent                │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│         Code Improvement Agent (L3)                 │
│  • Scans codebase with Groq                        │
│  • Analyzes patterns, types, consistency           │
│  • Identifies issues and opportunities             │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│         Task Proposal (universal_history)           │
│  Stores proposed tasks with:                        │
│  • Description of changes                           │
│  • Files to modify                                  │
│  • Preview of diffs                                 │
│  • Priority & complexity                            │
│  Status: 'pending_approval' ⏳                      │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│           User Confirmation UI                      │
│  Shows:                                             │
│  • Task description                                 │
│  • File diffs (before/after)                       │
│  • Estimated impact                                 │
│  • [Approve] [Reject] [Modify] buttons            │
└───────────────────┬─────────────────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
   [APPROVED]              [REJECTED]
        ↓                       ↓
        │                   Task marked
        │                   'rejected'
        ↓
┌─────────────────────────────────────────────────────┐
│         Code Improvement Agent                      │
│  Executes approved task:                            │
│  • Modifies files                                   │
│  • Runs tests                                       │
│  • Validates changes                                │
│  • Creates commit (optional)                        │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│              Results Report                         │
│  • Files modified: [list]                           │
│  • Lines changed: 127                               │
│  • Tests passed: ✓                                  │
│  • Linting: ✓                                       │
│  Status: 'completed' ✅                             │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│         Agent Memory Update                         │
│  Keywords extracted and stored in blueprint:        │
│  • 'api-consistency'                                │
│  • 'typescript-types'                               │
│  • 'error-handling'                                 │
│  Agent learns for future tasks 🧠                   │
└─────────────────────────────────────────────────────┘
```

---

## ❓ Decisions Needed from You

Before we can implement the closed-loop system, we need your input on three key decisions:

### Decision 1: Task Storage Strategy

**Question:** How should we store proposed tasks?

**Option A: Use Existing `universal_history` (Recommended)**
- ✅ No new table (follows Origo principle)
- ✅ Flexible JSONB payload
- ✅ Already has RLS policies
- ✅ Integrated with audit trail
- Example:
  ```json
  {
    "type": "proposed_task",
    "status": "pending_approval",
    "agent": "Code Improvement Agent",
    "description": "Refactor API routes",
    "files": ["/app/api/tasks/route.ts"],
    "preview_diff": "...",
    "priority": "medium"
  }
  ```

**Option B: Create New `agent_tasks` Table**
- ✅ Cleaner schema
- ✅ Easier queries
- ✅ Better type safety
- ❌ Violates "no new tables" principle
- ❌ Needs migration, RLS policies, indexes
- Schema:
  ```sql
  CREATE TABLE agent_tasks (
    id uuid PRIMARY KEY,
    project_id uuid REFERENCES projects(id),
    agent_id uuid REFERENCES agent_templates(id),
    description text NOT NULL,
    status text CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed')),
    payload jsonb,
    created_at timestamptz DEFAULT now()
  );
  ```

**Your Choice:** A or B? (We recommend A to follow Origo principles)

---

### Decision 2: Code Improvement Agent Design

**Question:** How should the Code Improvement Agent be structured?

**Option A: New Agent Template "Code Architect (L3)"**
- ✅ Dedicated specialist for code improvements
- ✅ Clear responsibility
- ✅ Can be enhanced independently
- System prompt focus: Code analysis, refactoring, best practices

**Option B: Enhance Manager Alpha**
- ✅ Fewer agents to manage
- ✅ Manager Alpha becomes more powerful
- ❌ Might dilute Manager Alpha's focus
- Add code improvement to existing capabilities

**Option C: New L2 Specialist "Code Quality Expert (L2)"**
- ✅ Fits existing hierarchy
- ✅ Can be called by Manager L3
- ✅ Focused on tactical code improvements
- Works alongside Hotel Expert, Tourism Expert, etc.

**Your Choice:** A, B, or C? (We recommend A for clarity)

---

### Decision 3: Task Confirmation Workflow

**Question:** Where should users review and approve tasks?

**Option A: Inline in Manager Alpha Chat**
- ✅ Simple user flow
- ✅ Context is immediate
- ❌ Limited space for diffs
- Shows task proposals as special chat messages with approve/reject buttons

**Option B: Dedicated `/tasks` Page**
- ✅ More space for previews
- ✅ Better for complex tasks
- ✅ Can show multiple tasks at once
- ❌ User has to navigate away
- Full task management interface

**Option C: Both (Hybrid Approach)**
- ✅ Best of both worlds
- ✅ Simple tasks inline
- ✅ Complex tasks in dedicated page
- Small tasks: inline approval
- Large tasks: "View in task manager" link

**Your Choice:** A, B, or C? (We recommend C for flexibility)

---

## 📋 Implementation Roadmap (Pending Your Decisions)

Once you confirm the above, here's what we'll build:

### Phase 2: Keyword Extraction & Agent Memory
**Estimated Time:** 2-3 hours
- [ ] Extract keywords from discussion_logs
- [ ] Update agent_blueprints with differentiation_keywords
- [ ] Test keyword accumulation over multiple discussions
- [ ] Verify agents use keywords in context

**Files to Create/Modify:**
- `src/core/keyword-extraction.ts` (new)
- `src/core/discussion-engine.ts` (enhance to call keyword extraction)

---

### Phase 3: Task Extraction System
**Estimated Time:** 3-4 hours
- [ ] Parse discussion_logs for action items
- [ ] Use Groq for structured extraction (optional)
- [ ] Store tasks based on your Decision 1
- [ ] Link tasks to discussions
- [ ] Set status: 'pending_approval'

**Files to Create/Modify:**
- `src/core/task-extraction.ts` (new)
- `app/api/tasks/extract/route.ts` (new API endpoint)

---

### Phase 4: User Confirmation UI
**Estimated Time:** 4-5 hours
- [ ] Based on your Decision 3:
  - Option A: Enhance Manager Alpha chat
  - Option B: Create /tasks page
  - Option C: Both
- [ ] Show task previews
- [ ] Display file diffs
- [ ] Approve/reject buttons
- [ ] Optimistic UI updates

**Files to Create/Modify:**
- `app/tasks/page.tsx` (if Decision 3 = B or C)
- `components/TaskPreview.tsx` (new)
- `components/TaskApproval.tsx` (new)

---

### Phase 5: Code Improvement Agent
**Estimated Time:** 6-8 hours
- [ ] Based on your Decision 2:
  - Create new agent template
  - Add agent to database
- [ ] Implement codebase analysis with Groq
- [ ] Pattern detection (missing types, inconsistencies)
- [ ] Generate code improvements
- [ ] Execute approved changes
- [ ] Report results

**Files to Create/Modify:**
- `supabase/migrations/YYYYMMDD_code_improvement_agent.sql` (if new agent)
- `src/core/code-analyzer.ts` (new)
- `src/core/code-executor.ts` (new)
- `app/api/code-improvement/route.ts` (new)

---

### Phase 6: Closed-Loop Integration
**Estimated Time:** 3-4 hours
- [ ] Connect all pieces
- [ ] Test full workflow
- [ ] Add logging and monitoring
- [ ] Create documentation
- [ ] User testing

**Files to Create/Modify:**
- `src/core/closed-loop-orchestrator.ts` (new)
- `CLOSED_LOOP_GUIDE.md` (documentation)

---

## 🎬 Ready to Proceed?

Please respond with your choices:

```
Decision 1 (Task Storage): A or B?
Decision 2 (Agent Design): A, B, or C?
Decision 3 (Confirmation UI): A, B, or C?
```

Once confirmed, we'll start implementation immediately with Phase 2 (Keyword Extraction), which doesn't require any new tables and will work regardless of your other choices.

---

## 🔧 What You Can Do Right Now

While waiting for decisions, you can:

1. **Review the documentation**
   - `.github/copilot-instructions.md`
   - `ORIGO_ARCHITECTURE.md`

2. **Test existing features**
   - Start a discussion in Manager Alpha
   - View completed meetings
   - Check agent hierarchy in database

3. **Prepare for closed loop**
   - Think about what code improvements you want
   - Consider which parts of codebase need attention
   - Define your approval workflow preferences

4. **Ask questions**
   - Anything unclear about Origo Architecture?
   - Want to see mock-ups of the UI?
   - Need more details on any phase?

---

## 📊 Summary: What's Different with Origo Architecture?

### Before (Traditional Approach):
```typescript
// Multiple layers of abstraction
class TaskService {
  constructor(
    private repo: TaskRepository,
    private validator: TaskValidator,
    private eventBus: EventBus
  ) {}
  
  async createTask(dto: CreateTaskDTO) {
    const validated = await this.validator.validate(dto);
    const entity = this.repo.create(validated);
    await this.eventBus.emit('task.created', entity);
    return this.toDTO(entity);
  }
}
```

### After (Origo Architecture):
```typescript
// Direct, minimal, data-centric
async function createTask(description: string, userId: string) {
  return await supabase
    .from('universal_history')
    .insert({
      user_id: userId,
      payload: {
        type: 'proposed_task',
        status: 'pending_approval',
        description
      }
    });
}
```

**Result:** Less code, clearer intent, easier to audit, database-driven logic.

---

## 🎯 The Goal: Self-Improving MAS

By following Origo Architecture, we're building a system where:

1. **Agents learn** from every interaction (keywords → memory)
2. **Users stay in control** (all actions confirmed)
3. **Code stays minimal** (no bloat, direct database access)
4. **Everything is auditable** (universal_history tracks all)
5. **System improves itself** (agents analyze and enhance code)

This becomes the foundation for creating MAS for other companies - a proven, tested system that's:
- ✅ Minimal
- ✅ Data-centric
- ✅ User-controlled
- ✅ Self-improving
- ✅ Fully auditable

Ready to build? **Please provide your three decisions and we'll start implementing!**
