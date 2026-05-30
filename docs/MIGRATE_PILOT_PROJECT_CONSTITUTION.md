# Migrate Pilot — Project Constitution

## 1. Project Identity

**Project Name:** Migrate Pilot  
**Project Type:** Local-first AI-human orchestration tool  
**Initial Target:** React 16, React 17, and React 18 applications upgrading to React 19  
**V1 Focus:** Safe, staged migration of React 16/17/18 projects to React 19, with human-reviewed diffs and validation gates at every step  
**Primary User:** Developer, Tech Lead, Frontend Lead, Solution Architect, or modernization team member  
**Execution Style:** AI executes step-by-step, human reviews and approves important decisions  

---

## 2. Product Goal

The goal of Migrate Pilot V1 is to help engineers **migrate React 16, React 17, and React 18 projects to React 19** through a safe, step-by-step, workspace-isolated, human-reviewed process.

- **Source:** React 16, React 17, React 18.
- **Target:** React 19.
- **Method:** staged migration, safe Git worktree workspace, human-reviewed diffs, validation gates.

The application should help users:

- Scan an existing React 16/17/18 project for React 19 compatibility signals.
- Detect outdated dependencies, deprecated APIs, JSX transform issues, and React 19 migration blockers.
- Generate a clear React 19 readiness report.
- Create a safe React 19 migration plan tailored to the detected source major (16, 17, or 18).
- Create an isolated migration workspace.
- Execute migration steps one at a time.
- Review code changes after each step.
- Validate each step through linting, type-checking, tests, and build checks.
- Keep the human in control before risky changes are accepted.

The product is not just a code converter or a single-codemod runner. It is a controlled, multi-phase React 19 migration workflow system.

---

## 3. Core Problem Being Solved

Upgrading a React project to React 19 is rarely a single command. Teams typically face these problems:

- React 16 / 17 / 18 projects each have a different upgrade surface to React 19 (legacy roots, deprecated APIs, JSX transform, removed lifecycle methods, breaking type changes).
- React 19 introduces removed/changed APIs (legacy context, string refs, `ReactDOM.render`, `findDOMNode`, propTypes/defaultProps on function components, etc.) that often surface as runtime regressions, not just compile errors.
- Old React projects also carry deprecated dependencies (old routing libraries, class components with deprecated lifecycle methods, outdated build tools and test setups) that block the React 19 jump.
- Manual migration takes time and requires repeated investigation across many files.
- AI tools can generate changes quickly, but without structure they may create risky, inconsistent, or unreviewed code.
- Developers need visibility into what changed, why it changed, and whether the project still works after each step.
- Migration should happen safely in small steps, not as one large uncontrolled rewrite.

This project solves the problem by combining:

- Static scanning
- AI-generated planning
- Isolated workspaces
- Step-based execution
- Human review
- Git-based safety
- Validation gates
- Logs and reports

---

## 4. Product Philosophy

This application must follow these principles:

### 4.1 Human-in-the-Loop by Default

AI can suggest, plan, and implement, but the human should remain the final decision-maker for important changes.

The user must be able to:

- Approve a migration plan.
- Review diffs.
- Accept or reject a step.
- Retry failed steps.
- Stop execution safely.
- Understand why a change was made.

### 4.2 Small Safe Steps Over Big Rewrites

The system must avoid large uncontrolled rewrites.

The React 19 migration should happen through small, reviewable steps such as:

- Preflight checks (Node, package manager, Git, React version).
- Tooling upgrade (build tool, TypeScript, ESLint, test runner).
- React 18 bridge step for React 16/17 projects (move to `createRoot`, new JSX transform, prepare for concurrent rendering).
- React 19 API-compatibility cleanup (deprecated lifecycles, string refs, legacy context, `ReactDOM.render`, `findDOMNode`, `propTypes`/`defaultProps` on function components).
- JSX transform / `tsconfig` / `jsx` mode alignment for React 19.
- React 19 upgrade (`react`, `react-dom`, types, peer deps).
- Source modernization (functional components, hooks-based patterns, ref-as-prop, `use` hook where applicable).
- Validation (lint, typecheck, tests, build).
- Final React 19 migration review.

### 4.3 Foundation-First, React-Major-Aware Migration

The recommended migration strategy is foundation-first **and source-major aware**. The plan is not the same for a React 16 project, a React 17 project, and a React 18 project.

Preferred order:

1. Project scan, source React version detection, dependency analysis.
2. Choose a migration track based on detected source major:
   - `react-16-to-19`: React 16 → React 18 bridge → React 19.
   - `react-17-to-19`: React 17 → React 18 bridge → React 19.
   - `react-18-to-19`: React 18 → React 19 directly.
3. Create migration workspace (Git worktree).
4. Upgrade tooling and dependency foundations.
5. Apply the React 18 bridge step where required.
6. Run React 19 API-compatibility cleanup.
7. Align JSX transform and React 19 type changes.
8. Upgrade `react` / `react-dom` to React 19.
9. Modernize source patterns (where small and safe).
10. Run validation.
11. Generate final React 19 migration summary.

Screen-flow migration, such as starting from login and then moving page by page, is **not** the V1 strategy. V1 is React-major-aware and phase-based.

### 4.4 Local-First Safety

V1 should be local-first.

The application should run on the user's machine and operate on local repositories. It should not require login or cloud authentication in V1 unless absolutely required by the selected AI provider.

### 4.5 Trust Through Visibility

The user should always understand:

- What project was selected.
- What was scanned.
- What risks were found.
- What plan was generated.
- What step is currently running.
- What files changed.
- What validation passed or failed.
- What the AI did and why.

Logs, reports, status indicators, diffs, and validation results are core parts of the product experience.

---

## 5. V1 Scope

V1 must stay focused and production-grade.

### 5.1 Supported Project Types in V1

V1 supports React 16, React 17, and React 18 projects that need to migrate to React 19:

- React 16 projects (legacy `ReactDOM.render`, class components, deprecated lifecycles).
- React 17 projects (new JSX transform optional, no automatic `createRoot`).
- React 18 projects (already on `createRoot`, concurrent rendering aware).
- JavaScript-based React projects and TypeScript-based React projects.
- Projects with deprecated APIs that React 19 removes or changes (string refs, legacy context, `findDOMNode`, `propTypes`/`defaultProps` on function components, etc.).
- Projects that may also need build-tool or dependency modernization to unblock the React 19 upgrade.

### 5.2 Out of Scope for V1

V1 does not support:

- Angular modernization
- Vue modernization
- Java Swing modernization
- COBOL modernization
- Backend modernization
- Full cloud SaaS mode
- Team collaboration dashboard
- Login and user management
- Multi-user approval workflow
- Automatic production deployment
- Fully autonomous migration without human review

These may be considered in future versions.

---

## 6. High-Level Architecture

The application should use a modular architecture.

Recommended high-level modules:

1. **Desktop / Local App Shell**
2. **Frontend UI**
3. **Backend Orchestration Layer**
4. **Project Scanner**
5. **Migration Planner**
6. **Workspace Manager**
7. **Execution Engine**
8. **AI Provider Adapter Layer**
9. **Git Manager**
10. **Validation Engine**
11. **Report Generator**
12. **Logs and Session State Store**

---

## 7. Recommended Technology Direction

The current direction is:

- **Frontend:** React + TypeScript + Tailwind CSS
- **Desktop Shell:** Tauri, if desktop packaging is needed
- **Backend/Orchestration:** Node.js or Python-based local orchestration layer
- **Git Operations:** Native Git commands through a controlled service layer
- **AI Execution:** Provider-agnostic adapter layer
- **Initial AI Integrations:** Cursor CLI / OpenCode CLI / configurable provider layer
- **Storage:** Local file-based session state or lightweight local DB
- **Validation:** npm/yarn/pnpm commands, lint, type-check, test, build

The exact stack can evolve, but the architecture must remain modular and provider-agnostic.

---

## 8. Main User Flow

The V1 user journey should follow this flow:

```text
Select Project
   ↓
Scan Project
   ↓
Show Readiness Report
   ↓
Generate Migration Plan
   ↓
Human Approves Plan
   ↓
Create Migration Workspace
   ↓
Execute Step
   ↓
Review Diff
   ↓
Approve / Reject / Fix
   ↓
Validate
   ↓
Commit Step
   ↓
Move to Next Step
   ↓
Final Summary Report
```

The execution loop can repeat many times:

```text
Execute Step → Review Diff → Approve / Reject / Fix → Validate → Commit Step
```

This loop is the heart of the product.

---

## 9. Screen-Level Product Flow

V1 should contain the following main screens:

### 9.1 Project Selection

Purpose:

- Let the user select a local legacy React project.
- Verify whether the selected project is migration-ready.
- Show basic project metadata.

Should show:

- Selected folder path
- Detected package manager
- React version
- Node/package metadata
- Git status
- Readiness status
- Blocking issues, if any

### 9.2 React 19 Compatibility Scan

Purpose:

- Analyze the project for React 19 readiness — structure, dependencies, scripts, and React-19-specific risk areas.

Should detect:

- Source React major (16, 17, or 18) and exact React + React DOM versions
- Recommended React 19 migration track (`react-16-to-19`, `react-17-to-19`, or `react-18-to-19`)
- Deprecated dependencies and React 19 peer-dep conflicts
- React 19 API risks (`ReactDOM.render`, `findDOMNode`, string refs, legacy context, deprecated lifecycle methods, `propTypes` / `defaultProps` on function components)
- JSX transform configuration and `tsconfig` `jsx` mode
- Build tool and bundler version
- TypeScript presence and React type version
- Package manager and lock files
- Test setup
- Git branch status
- Potential React 19 migration blockers

### 9.3 Readiness Report

Purpose:

- Present scan results in a clear, actionable format.

Should show:

- Overall readiness score
- Risk level
- Migration blockers
- Warnings
- Suggested migration direction
- Dependency concerns
- Validation commands available

### 9.4 React 19 Migration Plan

Purpose:

- Show the generated step-by-step React 19 migration plan, organized by phase and by the selected React migration track.
- Let the user review, approve, edit, or reject the plan.

Should show:

- Selected React 19 migration track (`react-16-to-19`, `react-17-to-19`, or `react-18-to-19`)
- Recommended phases (preflight, tooling, react-18-bridge, api-compatibility, jsx-transform, react-19-upgrade, source-modernization, validation, final-review)
- Total steps
- Risk per step
- Files / modules likely affected
- Validation command per step
- Human approval gate

### 9.5 Create Migration Workspace Confirmation

Purpose:

- Confirm where and how migration changes will be isolated.

Should show:

- Source project path
- Workspace path
- Branch name
- Git worktree or cloned workspace strategy
- Safety explanation
- Confirmation action

### 9.6 Execute React 19 Step

Purpose:

- Execute one approved React 19 migration step at a time inside the safe workspace.

Should show:

- Current React 19 step (phase + track context)
- Step status
- AI / scripted activity logs
- Files changed
- Token/cost estimate if available
- Validation result
- Retry/fix option

When no executable scripted step is available, the screen must make it clear that this is **not** a failure — some steps require future executors, codemods, validation, or AI-assisted implementation.

### 9.7 Diff Review

Purpose:

- Let the user review AI-generated changes before accepting.

Should show:

- Changed files
- Inline or side-by-side diff
- Step summary
- AI explanation
- Accept / Reject / Request Fix actions

### 9.8 React 19 Migration Summary

Purpose:

- Show what was migrated towards React 19 and what remains.

Should show:

- Source React major (16/17/18) and migration track used
- Final React + React DOM versions reached
- Completed steps grouped by phase
- Skipped steps
- Failed steps
- Commits created
- Dependencies changed
- Validation summary
- Remaining React 19 follow-ups (manual review, codemods to run later, etc.)

---

## 10. Migration Strategy

The default migration strategy is **foundation-first, React-major-aware, phase-based** with React 19 as the explicit target.

Recommended phase sequence:

1. **preflight** — Node, package manager, Git, and React version checks.
2. **tooling** — bring build tool, TypeScript, ESLint, and test runner to versions compatible with React 19.
3. **react-18-bridge** — for React 16 / 17 source projects: move to `createRoot`, adopt the new JSX transform, and prepare for concurrent rendering. Skipped for React 18 sources.
4. **api-compatibility** — replace or remove APIs that React 19 removes/changes: `ReactDOM.render`, `findDOMNode`, string refs, legacy context, deprecated lifecycle methods, `propTypes` / `defaultProps` on function components.
5. **jsx-transform** — align `tsconfig.json` / `jsx` configuration and any `@babel/preset-react` / Vite settings with React 19 expectations.
6. **react-19-upgrade** — upgrade `react`, `react-dom`, and `@types/react*` to React 19, plus pinned peer dependencies.
7. **source-modernization** — small, safe modernization (functional components, hooks, ref-as-prop, `use` hook where applicable).
8. **validation** — run lint, typecheck, tests, and build inside the workspace.
9. **final-review** — generate the React 19 migration summary.

The system must not blindly follow this list. It generates a project-specific React 19 plan based on scan results and the chosen migration track (`react-16-to-19`, `react-17-to-19`, or `react-18-to-19`).

---

## 11. Deprecated API and Dependency Strategy

The migration must handle React-19-incompatible APIs and deprecated libraries carefully.

Examples (representative, not exhaustive):

- `ReactDOM.render` → `createRoot` (React 18 bridge).
- `ReactDOM.hydrate` → `hydrateRoot`.
- `findDOMNode` → refs.
- String refs → callback refs or `useRef`.
- Deprecated lifecycle methods (`componentWillMount`, `componentWillReceiveProps`, `componentWillUpdate`) → `UNSAFE_*` rename or refactor.
- `propTypes` / `defaultProps` on function components → TypeScript types / default parameters.
- Legacy context → modern `React.createContext`.
- Build-tool / Node version bumps where React 19 requires it.

Expected behavior for each:

- Detect the deprecated API or dependency.
- Explain why it is a React 19 risk.
- Identify the compatible replacement.
- Plan the replacement as a separate React 19 migration step (with explicit phase and track context).
- Update the relevant files (package.json or source) only inside the workspace.
- Validate build, lint, and types after each step.
- Preserve existing runtime behavior unless the React 19 migration plan says otherwise.

Important rule:

A single migration step must not bundle multiple unrelated React 19 changes. Each step targets one concern (one phase, one cluster of files, one risk class).

---

## 12. Git and Workspace Strategy

The system must never modify the original project directly without creating a safe migration workspace.

Recommended strategy:

### 12.1 Preferred Approach

Use Git worktree when the project is already a Git repository.

Example:

```text
Original Project
   ↓
Create new migration branch
   ↓
Create separate Git worktree folder
   ↓
Run AI migration inside worktree
```

### 12.2 Why Worktree Is Preferred

Git worktree allows:

- Safe isolation
- Clean branch separation
- Easy diff review
- Easy rollback
- Parallel migration experiments
- Original folder remains untouched

### 12.3 Fallback Approach

If Git worktree is not possible:

- Create a separate copied workspace.
- Warn the user about limitations.
- Ensure original project remains unchanged.

### 12.4 Branch Naming

Use predictable branch names that make the React 19 intent obvious.

Example:

```text
migration/react-19-upgrade-{timestamp}
```

or

```text
migration/{project-name}-react-19
```

---

## 13. AI Provider Strategy

The system should be AI-provider agnostic.

It should not tightly couple the core product to a single provider.

### 13.1 AI Provider Adapter Layer

All AI providers should be accessed through an adapter layer.

Possible providers:

- Cursor CLI
- OpenCode CLI
- Claude-based tools
- OpenAI-based tools
- Local LLMs in future

### 13.2 AI Responsibilities

AI may be used for:

- Understanding project structure
- Explaining migration risks
- Generating migration plan
- Implementing a migration step
- Reviewing code changes
- Suggesting fixes
- Generating final summary

### 13.3 AI Restrictions

AI must not:

- Modify original project directly.
- Execute destructive commands without explicit approval.
- Skip validation silently.
- Make large unrelated changes in one step.
- Hide failed validations.
- Commit changes without user-approved workflow rules.

---

## 14. React 19 Compatibility Scanner Strategy

The scanner must provide deterministic project understanding before AI execution starts. It is the source of truth that selects the React 19 migration track and seeds the plan.

The scanner should inspect:

- `package.json`
- Lock files
- React + React DOM versions (and derived source major: 16 / 17 / 18)
- React 19 peer-dependency conflicts
- Build tool
- Package manager
- Scripts
- TypeScript presence and `tsconfig` `jsx` mode
- React 19 API risks (`ReactDOM.render`, `findDOMNode`, string refs, legacy context, deprecated lifecycle methods, `propTypes` / `defaultProps` on function components)
- Routing library
- State management library
- Test setup
- Folder structure
- Git status
- Existing lint / type / build commands

Scanner output should be structured and reusable by the planner and by AI agents. It includes a `React19MigrationContext` so the planner knows the source major, target major, recommended track, and recommended phases.

Suggested output file:

```text
.migration-orchestrator/scan-report.json
```

Suggested human-readable report:

```text
.migration-orchestrator/scan-report.md
```

---

## 15. Migration Session State

Each migration run should have a session record.

A session should track:

- Project path
- Workspace path
- Branch name
- Scan result
- Generated migration plan
- Current step
- Completed steps
- Failed steps
- Skipped steps
- User approvals
- Validation results
- Commits created
- Logs
- Final summary

Suggested folder:

```text
.migration-orchestrator/sessions/{session-id}/
```

Suggested files:

```text
session.json
plan.md
logs.txt
validation-results.json
final-summary.md
```

---

## 16. Validation Strategy

Validation is mandatory for trust.

The system should detect available validation commands from `package.json`.

Common commands:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

If commands are missing, the system should report them clearly instead of pretending validation passed.

### 16.1 Validation Levels

Recommended levels:

1. **Basic validation** — install/build check.
2. **Static validation** — lint/type-check.
3. **Test validation** — unit tests or integration tests.
4. **Final validation** — full build and final report.

### 16.2 Validation Rule

A step should not be marked complete unless validation status is known.

Possible statuses:

- Passed
- Failed
- Skipped by user
- Not available
- Needs manual verification

---

## 17. Error and Rollback Strategy

The system must be designed for failure recovery.

For every migration step, the system should know:

- What files changed
- What command was executed
- What validation failed
- Whether the step was committed
- How to revert the step

### 17.1 Failed Step Behavior

When a step fails:

- Show the error clearly.
- Show affected files.
- Suggest possible cause.
- Allow retry.
- Allow AI fix.
- Allow manual fix.
- Allow skip with warning.
- Allow rollback.

### 17.2 Rollback Rule

Rollback should be Git-based wherever possible.

No hidden destructive cleanup should happen without user confirmation.

---

## 18. Commit Strategy

Each approved migration step should ideally create a separate commit.

This gives:

- Better reviewability
- Easier rollback
- Clear migration history
- Safer PR creation

Example commit messages:

```text
chore(react-19): adopt createRoot in src/index.tsx (react-18 bridge)
chore(react-19): enable new JSX transform
refactor(react-19): replace findDOMNode with refs in Modal
fix(react-19): rename deprecated componentWill* lifecycle methods
chore(react-19): upgrade react and react-dom to 19.x
```

Commit messages should be generated based on the actual step, its React 19 phase, and the changed files.

---

## 19. Reporting Strategy

The app should generate reports that are useful to both developers and leads.

### 19.1 React 19 Compatibility Scan Report

Includes:

- Project metadata
- Detected source React major (16 / 17 / 18) and exact versions
- Recommended React 19 migration track
- Dependencies and React 19 peer-dep conflicts
- React-19-incompatible API usage
- Risk areas
- React 19 migration readiness
- Suggested strategy and recommended phases

### 19.2 React 19 Migration Plan Report

Includes:

- Selected React 19 migration track
- Phase-by-phase, step-by-step plan
- Risk rating
- Expected files / modules affected
- Validation method per step
- Human approval points

### 19.3 React 19 Migration Summary Report

Includes:

- Source React major and starting versions
- Final React + React DOM versions reached
- What changed, grouped by phase
- What passed
- What failed
- What was skipped
- What remains (manual follow-ups, codemods to run later)
- Suggested next phase or follow-up work

---

## 20. UI and UX Principles

The UI should feel production-grade, fast, and trustworthy.

### 20.1 Design Principles

- Clean and modern interface
- Clear workflow navigation
- Minimal distractions
- Strong status visibility
- Fast interactions
- Clear risk indicators
- Actionable errors
- Diff-first review experience
- Logs available but not overwhelming

### 20.2 Navigation

For V1, avoid unnecessary top navigation such as Dashboard, Logs, Settings, and similar sections unless they are truly needed.

The primary UX should be workflow-driven.

Recommended layout:

- Left side: workflow steps
- Center: current step content
- Right side: contextual details, risks, logs, or selected step information

### 20.3 Login

Login is not required in V1 because the product is local-first.

Authentication can be considered later if the product becomes cloud-based or team-based.

---

## 21. Performance Expectations

The application should feel fast and production-ready.

Important performance rules:

- Do not block the UI during long-running scans or AI execution.
- Stream logs in real time.
- Show progress states clearly.
- Avoid repeatedly scanning the whole project when cached results are valid.
- Keep session state lightweight.
- Avoid sending unnecessary large context to AI providers.
- Keep AI prompts scoped to the current step.
- Use deterministic scanners before using AI to reduce token usage.

---

## 22. Token and Cost Management

AI cost control is part of the product design.

The system should:

- Avoid sending the entire codebase unnecessarily.
- Use scanner output as compact context.
- Send only relevant files for each step.
- Keep migration steps small.
- Cache scan reports.
- Reuse previous project understanding.
- Show token or cost estimates if provider data is available.
- Prefer deterministic logic where AI is not required.

AI should be used where reasoning, planning, explanation, or code transformation is valuable.

---

## 23. Safety Rules for AI Agents

Any AI agent working on this project must follow these rules:

1. Do not modify the original project directly.
2. Always work inside the migration workspace.
3. Do not make unrelated changes.
4. Do not combine many migration goals into one step.
5. Do not remove files unless the plan explicitly requires it.
6. Do not upgrade many major dependencies at once unless approved.
7. Do not hide validation failures.
8. Do not mark a step complete without validation status.
9. Do not commit automatically unless the workflow allows it.
10. Explain every risky change in plain language.
11. Prefer reversible changes.
12. Preserve existing behavior unless the migration plan says otherwise.
13. Ask for human approval before destructive actions.
14. Keep logs and reports updated.

---

## 24. Definition of Done for V1

V1 can be considered complete when the app can:

- Select a local React 16, React 17, or React 18 project.
- Run the React 19 compatibility scan and detect the source React major.
- Detect React 19 migration blockers (incompatible APIs, deprecated lifecycle methods, peer-dep conflicts).
- Generate a React 19 readiness report.
- Generate a React 19 migration plan with the correct track (`react-16-to-19`, `react-17-to-19`, or `react-18-to-19`) and phases.
- Create a safe migration workspace.
- Execute at least one React 19 migration step through AI or scripted automation.
- Show changed files and diff.
- Allow user approval or rejection.
- Run validation command.
- Track migration session state.
- Generate the React 19 migration summary.

---

## 25. V1 Limitations

V1 should openly communicate its limitations.

Expected limitations:

- It may not fully migrate every project to React 19 automatically.
- Some code changes may require manual review.
- Some validations may not be available in older projects.
- Complex dependency upgrades may need manual decisions.
- Visual regression testing may not be available initially.
- It focuses only on React 16/17/18 → React 19 migration. Other source frameworks (Angular, Vue, etc.) are out of scope.
- It is local-first and not designed for multi-user enterprise collaboration yet.

---

## 26. Future Scope

Possible future versions may include:

- Angular modernization
- Next.js modernization
- Backend modernization
- Multi-user team workflows
- Cloud dashboard
- Role-based approvals
- GitHub/GitLab PR integration
- Jira integration
- Visual regression testing
- Automated test generation
- Migration analytics
- Organization-level governance rules
- Custom AI agent marketplace
- On-prem enterprise deployment

---

## 27. Immediate Next Steps After Base Architecture

Since the architecture and base structure are now ready, the recommended next steps are:

### Step 1: Add This Constitution to the Repo

Place this file at the root of the repository.

Recommended path:

```text
PROJECT_CONSTITUTION.md
```

This file should become the primary reference document for AI tools and developers.

### Step 2: Create Core Product Documents

Create a `docs/` folder with:

```text
docs/product-overview.md
docs/v1-architecture.md
docs/v1-user-flow.md
docs/migration-strategy.md
docs/ai-agent-rules.md
docs/git-workspace-strategy.md
docs/validation-strategy.md
```

### Step 3: Create Initial App Shell

Build the base UI shell with:

- Workflow sidebar
- Main content area
- Context details panel
- Empty states
- Status indicators
- Loading states
- Error states

### Step 4: Implement Project Selection

Implement:

- Folder selection
- Project path display
- Basic project metadata reading
- Git repository detection
- Package manager detection

### Step 5: Implement Scanner V1

Scanner V1 should read:

- `package.json`
- Lock files
- React version
- Scripts
- Dependencies
- Dev dependencies
- Deprecated packages
- TypeScript status
- Sass status
- Router status
- Test/build commands

### Step 6: Generate Readiness Report

Create a structured report from scanner output.

The report should include:

- Readiness status
- Risk score
- Blockers
- Warnings
- Recommendations

### Step 7: Implement Migration Plan Generator

Use scanner output to generate a first migration plan.

Initially this can be rule-based. AI-based plan generation can be added after the deterministic planner is stable.

### Step 8: Implement Workspace Creation

Implement safe workspace creation using:

- Git branch
- Git worktree
- Fallback copy mode if needed

### Step 9: Implement One End-to-End React 19 Migration Step

Start with a simple but valuable React 19 step. For example:

```text
React 18 bridge: replace ReactDOM.render with createRoot in the application entry file.
```

This is a good first real React 19 migration step because it is common (every React 16/17 project needs it), valuable (it unblocks the rest of the React 19 migration), and bounded (it touches a small, well-known set of files).

### Step 10: Implement Diff Review and Validation

After the first step executes:

- Show changed files.
- Show diff.
- Run available validation command.
- Allow approve/reject.
- Track result in session state.

---

## 28. Recommended First Milestone

The first meaningful milestone should be:

```text
A user can select a React 16, React 17, or React 18 project, run the React 19 compatibility scan, get a readiness report, generate and approve a React 19 migration plan, create a safe workspace, execute one bounded React 19 step (for example: replace ReactDOM.render with createRoot), review the diff, run build validation, and generate a React 19 migration summary.
```

This milestone proves the full product loop end-to-end against the real React 19 target.

It is better than building many screens without one working end-to-end React 19 migration workflow.

---

## 29. AI Instruction for Future Work

Any AI assistant, Cursor agent, or coding agent working on this project should read this constitution first.

Before making changes, the AI should understand:

- This is a local-first React 19 migration orchestrator.
- V1 is focused on migrating React 16, React 17, and React 18 projects to React 19.
- The migration is staged, React-major-aware, and phase-based.
- The workflow must be safe, step-based, reviewable, and Git-backed.
- The original project must not be modified directly.
- Human approval is central to the product.
- The system must prefer small reversible changes.
- Validation and reporting are mandatory parts of the workflow.
- The product must feel production-grade, not like a demo.

When uncertain, the AI should choose the safer, smaller, more reviewable implementation path.

---

## 30. Product North Star

The north star of this project is:

> Help development teams safely migrate React 16, React 17, and React 18 projects to React 19, one validated step at a time, with AI doing the heavy lifting and humans staying in control.

