# Agent Orchestration Guide for PA-Pedia

**Last Updated**: 2025-11-13
**Purpose**: Establish clear delegation patterns to ensure specialized agents are used appropriately rather than the main agent doing all work.

## Executive Summary

The PA-Pedia project has 8 well-defined specialized agents covering specific domains (Go, React, CLI design, etc.). However, **the main agent lacks a clear decision framework** for when to delegate vs. when to handle tasks directly. This results in the main agent doing work that should be delegated.

### Key Issues Identified

1. **No Decision Tree**: The main agent doesn't have explicit criteria for delegation decisions
2. **Overlapping Agent Scopes**: `team-lead-architect` and `project-planner` are too similar
3. **Missing Sequencing Rules**: No clear guidance on agent workflows (which agents should work together, in what order)
4. **Implicit vs Explicit Responsibilities**: Some agent roles are implied but not clearly stated
5. **No Main Agent Role Definition**: The main agent's responsibilities aren't explicitly defined

---

## Current Agent Inventory

### Domain Specialists (Code Implementation)
| Agent | Purpose | When to Delegate |
|-------|---------|-----------------|
| **go-expert-developer** | Go CLI implementation, architecture, code review | When writing/reviewing Go code |
| **react-ui-developer** | React components, TypeScript, state management | When building web UI |
| **cli-design-architect** | CLI command design and UX | When designing CLI interface structure |
| **ux-design-consultant** | UX design, interface recommendations | When designing non-CLI user experiences |

### Coordinators & Planners (Strategic Work)
| Agent | Purpose | When to Delegate |
|-------|---------|-----------------|
| **team-lead-architect** | Break down requirements, coordinate specialist agents | For multi-component features |
| **project-planner** | Maintain project plan, sequence tasks, analyze requirements | For project planning & progress tracking |

### Support Agents (Infrastructure)
| Agent | Purpose | When to Delegate |
|-------|---------|-----------------|
| **docs-maintainer** | README.md, CLAUDE.md, documentation sync | When documentation needs updating |
| **git-source-control** | Commits, branches, PRs, repository operations | When code changes are ready to save/push |

---

## Critical Problems with Current Definitions

### Problem 1: team-lead-architect vs project-planner Overlap

**Current State**:
- Both agents break down requirements into tasks
- Both analyze dependencies and sequencing
- Both create/update plans

**Difference (Subtle)**:
- `team-lead-architect`: More coordinative/strategic - delegates to specialists
- `project-planner`: More documentation-focused - maintains project plan documents

**Issue**: This distinction is unclear. A user might delegate the same task to either agent.

**Recommendation**: Clarify that these serve different purposes:
- Use **project-planner** to: Create/update/review project plan documents, assess progress, sequence Phase 1 → Phase 2 work
- Use **team-lead-architect** to: Break down a specific feature request into implementation tasks for specific agents

### Problem 2: No Main Agent Role Definition

**Current State**: The instructions assume main agent will:
- Read CLAUDE.md and project context
- Explore codebases with Explore agent
- Execute tasks
- Decide when to delegate

**Issue**: "Execute tasks" is vague. What does the main agent actually execute vs delegate?

**Recommendation**: Define main agent responsibilities as:
1. **Planning** (with team-lead-architect if multi-component)
2. **Coordination** (managing workflow between agents)
3. **Clarification** (asking questions when requirements are ambiguous)
4. **Quality Review** (ensuring completed agent work meets criteria)
5. **Context Synthesis** (reading CLAUDE.md, existing code to inform decisions)

### Problem 3: No Explicit Delegation Triggers

**Current State**: Instructions say "use Task tool when..." but don't create a decision framework.

**Issue**: Main agent must make judgment calls that are ambiguous:
- "Should I read this code or delegate to Explore agent?"
- "Should I implement this or delegate to go-expert-developer?"
- "Do I need team-lead-architect for this feature request?"

**Recommendation**: Create explicit decision criteria for each delegation trigger (see section below).

### Problem 4: Missing Agent for Codebase Exploration Coordination

**Current State**: Explore agent exists but main agent decides whether to use it.

**Issue**: Open-ended exploration questions often need an agent, but it's not always clear.

**Recommendation**: Establish clear pattern: **If you don't know the answer after 1-2 file reads, use Explore agent.**

---

## Delegation Decision Framework

Use this flowchart to decide when to delegate vs handle directly:

```
┌─────────────────────────────────────────────────────────────┐
│ Task Received from User                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
            ┌─────────────────────────────────┐
            │ Does this involve MULTIPLE      │
            │ specialized domains?            │
            │ (Go + React, CLI + Docs, etc.)  │
            └─────────────────────────────────┘
                 ↙               ↘
              YES                NO
              ↓                  ↓
      ┌───────────────┐    ┌──────────────────┐
      │ Delegate to   │    │ Is it a domain   │
      │ team-lead-    │    │ specialist task? │
      │ architect for │    └──────────────────┘
      │ orchestration │         ↙         ↘
      └───────────────┘      YES           NO
                              ↓            ↓
                    ┌──────────────────┐  ┌────────────────┐
                    │ Domain Match?    │  │ Is it planning │
                    │ - Go code?       │  │ work?          │
                    │ - React code?    │  │                │
                    │ - CLI design?    │  └────────────────┘
                    │ - UX work?       │       ↙        ↘
                    │ - Documentation? │     YES         NO
                    │ - Git ops?       │      ↓          ↓
                    └──────────────────┘  ┌──────────┐ ┌──────────┐
                         ↓ MATCH         │Delegate  │ │Can you   │
                    ┌──────────────────┐  │to project│ │answer it │
                    │Delegate to       │  │-planner  │ │quickly?  │
                    │specialist agent  │  └──────────┘ └──────────┘
                    └──────────────────┘       ↓            ↙    ↘
                                         (Update plan,    YES     NO
                                          track progress)  ↓       ↓
                                                     Handle   Need more
                                                     directly  research?
                                                              ↓
                                                         Delegate to
                                                         Explore agent
```

### Specific Delegation Triggers

#### Delegate to go-expert-developer when:
- Writing Go code for the CLI ✓
- Reviewing Go code for patterns/idioms ✓
- Debugging Go concurrency or performance issues ✓
- Advising on Go project structure ✓
- **Don't delegate**: Go CLI design (use cli-design-architect first) ✗

#### Delegate to react-ui-developer when:
- Implementing React components ✓
- Reviewing React code or component architecture ✓
- Debugging React performance or state issues ✓
- Advising on TypeScript types for components ✓
- **Don't delegate**: UI/UX design decisions (use ux-design-consultant) ✗

#### Delegate to cli-design-architect when:
- Designing the command structure (before implementation) ✓
- Reviewing CLI UX for discoverability/consistency ✓
- Deciding on command naming, flags, subcommand hierarchy ✓
- Advising on error messages and help text structure ✓
- **Don't delegate**: Actually writing Go code ✗

#### Delegate to team-lead-architect when:
- Feature requires multiple specialized agents ✓
- You're unsure which specialists are needed ✓
- Requirements need translation into implementation tasks ✓
- You need coordination across Go CLI and React web components ✓
- **When to use**: High-level feature requests before specific tasks
- **Example**: "Build faction upload and storage system"

#### Delegate to project-planner when:
- Reviewing overall project progress ✓
- Creating/updating PROJECT_PLAN.md ✓
- Sequencing work across phases ✓
- Determining what to work on next ✓
- Estimating task dependencies ✓
- **When to use**: At project milestones, not for individual features
- **Example**: "What should we implement after Phase 1?"

#### Delegate to docs-maintainer when:
- README needs updates ✓
- CLAUDE.md needs synchronization with code changes ✓
- New features need documentation ✓
- Documentation is outdated after implementation ✓
- **When to use**: After code changes or at project milestones
- **When NOT to use**: For inline code comments or docstrings (those are specialist domain)

#### Delegate to git-source-control when:
- Code changes are ready to commit ✓
- Need to create branches or PRs ✓
- Repository status/history questions ✓
- **When to use**: At end of implementation, not beginning
- **When NOT to use**: For understanding git history/branching (you can handle this)

#### Use Explore agent when:
- Codebase structure question and you don't know where to look ✓
- Looking for specific patterns/implementations ✓
- Need comprehensive codebase overview ✓
- After 1-2 file reads you still don't have answer ✓
- **Query example**: "Where are React components that handle faction uploads?"
- **Don't use**: For single file reads or simple questions

---

## Recommended Workflow Patterns

### Pattern 1: Multi-Component Feature Request
```
User: "I need to add faction upload and comparison UI"

1. Main Agent: Clarify requirements if needed
2. Delegate to team-lead-architect
3. team-lead-architect returns:
   - Task breakdown
   - Assignment to specialized agents
   - Sequencing
4. Main Agent: Coordinate execution of assigned tasks
5. Go-expert-developer: Implement backend/CLI changes (if needed)
6. React-ui-developer: Implement frontend components
7. Main Agent: Ensure integration, verify success
8. Delegate to git-source-control: Commit/push completed work
```

### Pattern 2: Single-Domain Implementation
```
User: "Implement the faction metadata validation in Go"

1. Main Agent: Understand requirements from CLAUDE.md
2. Delegate to go-expert-developer
3. go-expert-developer: Design, implement, review
4. Main Agent: Verify against requirements
5. Delegate to git-source-control: Commit/push
```

### Pattern 3: Codebase Question
```
User: "Where do we handle faction data loading in the web app?"

1. If you can answer from context → Answer directly
2. If you need to search → Use Explore agent
3. Present findings to user
```

### Pattern 4: Project Progression
```
Scenario: Just completed Phase 1

1. Main Agent: Recognize milestone completion
2. Delegate to project-planner
3. project-planner: Updates PROJECT_PLAN.md, recommends Phase 2 tasks
4. Delegate to docs-maintainer: Update CLAUDE.md if needed
5. Main Agent: Present next steps to user
```

---

## Main Agent Responsibilities (Explicit Definition)

The main agent (Claude) should handle:

### 1. Context Synthesis
- Read and understand CLAUDE.md, PROJECT_PLAN.md
- Understand project architecture and patterns
- Identify relevant constraints and conventions
- This is NOT delegation - this is preparation

### 2. Requirement Clarification
- Ask clarifying questions when requirements are ambiguous
- Identify implicit requirements from project context
- Validate requirements against existing architecture
- Decide if requirements need adjustment

### 3. Orchestration & Sequencing
- When multiple agents are needed, sequence their work
- Ensure agent outputs align and integrate
- Identify dependency chains
- Coordinate handoffs between agents

### 4. Quality Verification
- Review specialized agent outputs
- Verify they meet requirements and follow patterns
- Catch integration issues before implementation
- Ensure consistency with project conventions

### 5. User Communication
- Summarize complex agent work for user
- Explain decisions and trade-offs
- Report progress and blockers
- Ask for feedback or clarification

### 6. Work Coordination
- Decide which agents are needed for each task
- Provide comprehensive prompts with context
- Track progress across multiple agents
- Identify when assumptions need validation

### What Main Agent Should NOT Do:
- ✗ Write Go/React code (delegate to specialists)
- ✗ Make CLI design decisions (delegate to cli-design-architect)
- ✗ Design UX (delegate to ux-design-consultant)
- ✗ Commit/push code (delegate to git-source-control)
- ✗ Update documentation directly (delegate to docs-maintainer)
- ✗ Explore codebase for basic questions (delegate to Explore agent when needed)

---

## PA-Pedia Specific Delegation Patterns

For the PA-Pedia project specifically:

### Starting Phase 1 (CLI Implementation)
```
1. Main: Review PROJECT_PLAN.md Phase 1 tasks
2. Delegate to cli-design-architect:
   - Review/validate command structure in CLAUDE.md
   - Ensure subcommand design is sound
3. Delegate to go-expert-developer:
   - Implement CLI with Cobra
   - Implement parser logic
   - Set up module structure
4. Main: Verify design matches implementation
5. Delegate to docs-maintainer: Ensure CLAUDE.md CLI section is accurate
6. Delegate to git-source-control: Commit Phase 1 work
```

### Implementing a Feature (e.g., "Add mod extraction")
```
1. Main: Check PROJECT_PLAN.md for this feature's context
2. Main: Review relevant CLAUDE.md patterns section
3. Delegate to go-expert-developer:
   - Design implementation approach
   - Write code
   - Test
4. Main: Code review against patterns
5. Delegate to git-source-control: Commit with clear message
```

### Major Architecture Decision (e.g., "Should we change faction folder structure?")
```
1. Main: Gather requirement/reason for change
2. Delegate to team-lead-architect:
   - Analyze impact on both CLI and web
   - Recommend approach
   - Sequence implementation
3. Delegate to docs-maintainer:
   - Update CLAUDE.md patterns section
   - Update PROJECT_PLAN.md if needed
4. Main: Coordinate agent work implementing the change
```

---

## Resolving Ambiguities: Decision Examples

### Example 1: "Should I implement JSON schema generation?"
```
Unclear? Would this require coordinating between:
- Go code to generate schemas (go-expert-developer)
- TypeScript code to consume schemas (react-ui-developer)
- Decision: Delegate to team-lead-architect to coordinate
```

### Example 2: "Where is unit cost calculation happening in the CLI?"
```
Can you answer quickly?
- YES: Look at CLAUDE.md patterns or read relevant file
- NO: Use Explore agent with query like "Where does CLI calculate unit costs?"
```

### Example 3: "I want better faction comparison UI"
```
Is it a multi-component feature?
- YES: Delegate to team-lead-architect for orchestration
- NO: Delegate directly to react-ui-developer
```

### Example 4: "CLI commands seem confusing"
```
Do you need to:
- Design command structure? → cli-design-architect
- Implement the commands? → go-expert-developer
- Review overall architecture? → team-lead-architect
- Answer: Probably cli-design-architect first, then go-expert-developer
```

---

## Summary: The Delegation Principle

**Core Principle**: The main agent is an orchestrator and quality reviewer, not a code executor.

- **Specialists execute** (Go, React, CLI, UX, Docs)
- **Coordinators plan** (team-lead-architect, project-planner)
- **Main agent decides** who needs to do what
- **Main agent verifies** it's done correctly

If the main agent is writing code, designing UX, updating docs directly, or making CLI decisions — that's a sign delegation should have happened instead.

---

## Implementation: How to Use This Guide

1. **For Developers**: Before starting a task, check the decision framework
2. **For Main Agent**: Reference this when deciding whether to delegate
3. **For Code Review**: Use this to verify specialists handled appropriate tasks
4. **For New Agents**: This pattern can be extended for additional agents

---

## Future: Agent Additions

If new agents are added, follow this template:
- **Name & Purpose**: Clear, single domain
- **When to Delegate**: Explicit triggers
- **What NOT to Delegate**: Clear exclusions
- **Input/Output**: What the agent expects, what it provides
- **Integration**: How it coordinates with other agents
