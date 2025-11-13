# PA-Pedia Agent Delegation Patterns

**For**: PA-Pedia project contributors and AI agents
**Purpose**: Specific patterns for delegating work in the PA-Pedia context

This document applies general agent orchestration principles (see `AGENT_ORCHESTRATION_GUIDE.md`) to PA-Pedia specifically.

## PA-Pedia Architecture Reminder

Two main components:
1. **CLI (Go)**: Extract unit data from PA installations and mods
2. **Web (React/TypeScript)**: Browse and compare factions

---

## Common PA-Pedia Scenarios & Delegation

### Scenario 1: "Implement mod extraction from zip files"

**This is**: A single-component feature (CLI only)

**Delegation Pattern**:
```
User: "Implement mod extraction from zip files in the CLI"
↓
Main Agent: Check PROJECT_PLAN.md - confirm this is Phase 1 work
↓
Delegate to: go-expert-developer
- What: Extract mods from server_mods directory zip files
- Where: cli/pkg/exporter/ or cli/pkg/loader/
- Reference: CLAUDE.md patterns → Mod Overlay System section
↓
go-expert-developer: Design and implement Go code
↓
Main Agent: Verify against patterns, check zip extraction logic
↓
Delegate to: git-source-control
- Create commit with clear message about mod extraction
```

### Scenario 2: "Build faction upload UI in the web app"

**This is**: A single-component feature (Web only)

**Delegation Pattern**:
```
User: "Users need to upload faction zip files"
↓
Main Agent: Does this need design input?
- Yes, but UI is straightforward (file input + upload)
- Check if ux-design-consultant is needed (probably not for simple file upload)
↓
Delegate to: react-ui-developer
- What: File upload form for faction zips, show upload progress
- Where: web/src/components/ or web/src/pages/
- Reference: CLAUDE.md → Data Models → Faction Metadata
- Tech: Use JSZip to parse uploaded faction structure
↓
react-ui-developer: Design component, implement with TypeScript
↓
Delegate to: git-source-control
- Create commit for UI implementation
```

### Scenario 3: "Add side-by-side faction comparison feature"

**This is**: Multi-component feature (Design + React)

**Delegation Pattern**:
```
User: "Players want to compare two factions side-by-side"
↓
Main Agent: This spans design + implementation
↓
Delegate to: ux-design-consultant
- What should the comparison layout be?
- How should unit matching work?
- What data should be shown?
↓
ux-design-consultant: Provides design mockup/specification
↓
Main Agent: Synthesize design into implementation tasks
↓
Delegate to: react-ui-developer (with design as input)
- Implement comparison component
- TypeScript types for comparison data
- State management with Zustand
↓
react-ui-developer: Implements based on design
↓
Delegate to: git-source-control
- Commit with reference to design discussion
```

### Scenario 4: "Rethink the CLI command structure"

**This is**: CLI Architecture (Design only, no implementation)

**Delegation Pattern**:
```
User: "Our CLI commands seem confusing. Let's redesign the structure."
↓
Main Agent: This is a design question, not implementation
↓
Delegate to: cli-design-architect
- Review current command structure (reference CLAUDE.md)
- Propose improvements
- Consider usability, discoverability, consistency
↓
cli-design-architect: Provides new command structure proposal
↓
Main Agent: Review proposal, discuss trade-offs
↓
If approved:
  Delegate to: go-expert-developer
  - Implement new command structure in Cobra
  - Test CLI behavior
↓
Delegate to: git-source-control
- Commit refactored CLI
```

### Scenario 5: "CLI is crashing when extracting mods with special characters"

**This is**: Bug debugging (Go code)

**Delegation Pattern**:
```
User: "CLI crashes with some mod names. Error: X"
↓
Main Agent: Gather context
- What error message?
- Which mod names cause it?
- What's the exact crash location?
↓
Delegate to: go-expert-developer
- Debug the issue
- Fix the bug
- Add error handling
- Consider if issue exists elsewhere
↓
go-expert-developer: Fixes and tests
↓
Delegate to: git-source-control
- Commit with "fix:" type, clear message about the bug
```

### Scenario 6: "Phase 1 is done. What's next?"

**This is**: Project-level planning

**Delegation Pattern**:
```
User: "We've completed Phase 1 CLI. What should we do now?"
↓
Main Agent: This is project progression
↓
Delegate to: project-planner
- Review PROJECT_PLAN.md Phase 1 completion
- What are Phase 2 priorities?
- Are there Phase 1 blockers for Phase 2?
- Update PROJECT_PLAN.md with status
↓
project-planner: Reviews plan, recommends next phase work
↓
Main Agent: Present recommendation to user
↓
Next step: Start Phase 2 work with team-lead-architect or specialists
```

### Scenario 7: "Implement schema generation for PA unit types"

**This is**: Multi-component architecture task

**Delegation Pattern**:
```
User: "Generate JSON schemas from Go structs and TypeScript types from schemas"
↓
Main Agent: This spans Go code generation + TypeScript code generation
↓
Delegate to: team-lead-architect
- How should schema generation integrate with build?
- What's the Go→Schema→TypeScript pipeline?
- Who does what and in what order?
↓
team-lead-architect: Provides orchestration plan
- Go Expert: Implement schema generation in Go
- Web team: Implement schema→TypeScript in build
- Build process: Chain these together
↓
Main Agent: Coordinate execution of team's tasks
↓
Delegate to: docs-maintainer
- Update CLAUDE.md with schema generation workflow
↓
Delegate to: git-source-control
- Commit schema generation setup
```

### Scenario 8: "Update docs for the new CLI commands"

**This is**: Documentation work

**Delegation Pattern**:
```
User: "Update README and CLAUDE.md for the new CLI structure"
↓
Main Agent: This is documentation, not code
↓
Delegate to: docs-maintainer
- Update CLI usage section in CLAUDE.md
- Update README with new command examples
- Ensure consistency with actual CLI
↓
docs-maintainer: Updates documentation files
↓
Delegate to: git-source-control
- Commit docs update with "docs:" type
```

---

## Decision Tree for PA-Pedia

```
┌─ What are you implementing? ──────────────────────────────┐
│                                                            │
├─ CLI parsing/extraction (Go code)?                        │
│  └─→ go-expert-developer                                  │
│                                                            │
├─ Web UI component (React code)?                           │
│  ├─ Need UX design first?                                 │
│  │  ├─ YES → ux-design-consultant, then react-ui-dev     │
│  │  └─ NO → react-ui-developer                            │
│  │                                                         │
│  └─ Need CLI command design?                              │
│     ├─ YES → cli-design-architect, then go-expert-dev    │
│     └─ NO → go-expert-developer                           │
│                                                            │
├─ Documentation updates?                                   │
│  └─→ docs-maintainer                                      │
│                                                            │
├─ Git/repository work?                                     │
│  └─→ git-source-control                                   │
│                                                            │
├─ Feature spans CLI + Web?                                 │
│  └─→ team-lead-architect (to coordinate), then      │
│      specialists for actual work                          │
│                                                            │
├─ Project progression / "what's next?"                     │
│  └─→ project-planner                                      │
│                                                            │
└─ Unsure about codebase / need exploration?               │
   └─→ If not sure after 1-2 file reads → Explore agent    │
```

---

## PA-Pedia Specific Tips

### When Delegating to go-expert-developer
- Reference CLAUDE.md section: "Migration from Old Codebase"
- Old working code at: `/old/project/cli/`
- Key patterns already documented in CLAUDE.md
- PA unit parsing is complex; include context about base_spec inheritance

### When Delegating to react-ui-developer
- Reference CLAUDE.md data models
- Mention Zustand for state management (not Context)
- All components should be TypeScript
- Dark mode is default (Tailwind dark: class)
- Reference schema files for type generation

### When Delegating to cli-design-architect
- Reference existing PA CLI patterns in CLAUDE.md
- Consider that unit extraction might need progress indicators
- Think about mod priority and which mod to extract from
- Subcommands for: extract base, extract mod, validate, generate-schema

### When Delegating to team-lead-architect
- State what components need to coordinate (CLI + Web? Which CLI commands + which UI?)
- Reference PROJECT_PLAN.md phases for context
- Be clear about dependencies

### When Delegating to project-planner
- Ask: "What should we prioritize in Phase X?"
- Reference PROJECT_PLAN.md structure
- Success criteria are in CLAUDE.md "Success Criteria" section

---

## Examples of WRONG Delegation

### ❌ Wrong: Asking go-expert-developer about CLI design
```
NO: "How should the extract command be structured?"
YES: "Design the extract command structure" → cli-design-architect
```

### ❌ Wrong: Asking react-ui-developer about UX layouts
```
NO: "How should we layout the comparison view?"
YES: "Design the faction comparison view" → ux-design-consultant
```

### ❌ Wrong: Asking project-planner for specific feature tasks
```
NO: "Break down the faction upload feature"
YES: "Break down the faction upload feature" → team-lead-architect
```

### ❌ Wrong: Main agent writing Go/React code
```
NO: [Main agent writes Go parser code]
YES: Describe requirement → go-expert-developer → implements
```

---

## PA-Pedia Current Status

**Project Phase**: 1 (CLI Foundation) - Planning/Initialization

**Next Delegation Steps**:
1. Delegate to **project-planner**: Confirm Phase 1 task sequencing
2. Delegate to **cli-design-architect**: Review/validate CLI structure design
3. Delegate to **go-expert-developer**: Implement CLI Phase 1
4. Delegate to **project-planner**: Update plan with Phase 1 progress
5. Delegate to **project-planner**: Recommend Phase 2 start

---

## For AI Assistants Working on PA-Pedia

When you receive a task:
1. **Check this file first** to see if there's a matching scenario
2. **Use the decision tree** to determine delegation
3. **Reference CLAUDE.md** for project context
4. **Reference PROJECT_PLAN.md** for phase context
5. **If unsure**, default to delegating to a specialist rather than handling yourself

Your value is in orchestration and quality verification, not in code execution.
