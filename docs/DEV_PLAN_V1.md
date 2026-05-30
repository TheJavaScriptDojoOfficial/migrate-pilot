# Migrate Pilot — V1 Development Plan

## 1. Current Status

The base architecture and initial project structure are completed.

The project now has:

- V1 architecture blueprint
- Project constitution
- Base folder structure
- Initial product direction
- Local-first scope
- React 16 / React 17 / React 18 → React 19 migration as the V1 focus

The next phase is controlled implementation.

---

## 2. V1 Development Goal

Build a local-first migration orchestration application that helps users **migrate React 16, React 17, and React 18 projects to React 19** step by step with AI assistance and human review.

- **Source:** React 16, React 17, React 18.
- **Target:** React 19.
- **Method:** staged migration, safe Git worktree workspace, human-reviewed diffs, validation gates.

V1 should support:

- Selecting a local React 16/17/18 project
- Running the React 19 compatibility scan
- Detecting React 19 migration readiness and source major
- Creating a safe migration workspace
- Generating a React 19 migration plan (track + phases)
- Executing React 19 migration steps one at a time
- Reviewing diffs before accepting changes
- Running validation commands
- Maintaining migration session state
- Showing logs, status, and errors clearly

V1 should not try to fully automate everything without review.

The goal is:

> AI assists, system controls, human approves.

---

## 3. Core V1 Principles

### 3.1 Safety First

The app must never directly modify the original project.

All migration work should happen inside a safe workspace using one of the approved strategies:

- Git worktree
- Separate cloned workspace
- Dedicated migration branch

### 3.2 Human-in-the-Loop

Every meaningful migration step should support review before final acceptance.

The user should be able to:

- Approve
- Reject
- Retry
- Skip
- Review diff
- Run validation

### 3.3 Small Step Migration

The React 19 migration should happen in small controlled steps, organized by phase.

Example (representative — actual plan depends on detected source major and scan output):

1. Preflight (Node, package manager, Git, React version)
2. Tooling upgrade (build tool, TypeScript, ESLint, test runner)
3. React 18 bridge (for React 16/17 sources: `createRoot`, new JSX transform)
4. React 19 API-compatibility cleanup (`ReactDOM.render`, `findDOMNode`, deprecated lifecycles, string refs, legacy context)
5. JSX transform / `tsconfig` alignment for React 19
6. Upgrade `react`, `react-dom`, and types to React 19
7. Source modernization (small, safe patterns)
8. Run validation (lint, typecheck, tests, build)
9. Generate React 19 migration summary

### 3.4 Local-First

V1 is a local developer tool.

No login, cloud sync, team dashboard, or SaaS dependency is required in V1.

### 3.5 Production-Grade UX

The app should feel reliable, fast, and professional.

Important UX rules:

- Clear current step
- Clear next action
- No hidden AI execution
- Logs should be visible
- Errors should be understandable
- Risk should be communicated clearly

---

# 4. Development Phases

## Phase 1: Application Shell

### Goal

Create the stable app shell and layout foundation.

### Features

- Main app layout
- Sidebar workflow navigation
- Header area
- Main content area
- Status area
- Basic responsive behavior
- Empty states
- Basic routing

### Screens

- Project Selection
- Scan Report
- Migration Plan
- Workspace Confirmation
- Execution
- Summary
- Settings

### Acceptance Criteria

- App opens successfully
- Navigation works
- Layout is consistent
- No broken screen transitions
- No actual migration logic required yet

---

## Phase 2: Project Selection

### Goal

Allow the user to select a local React 16, React 17, or React 18 project safely.

### Features

- Select project folder
- Show selected path
- Detect package.json
- Detect git repository
- Detect React dependency and React major (16 / 17 / 18)
- Detect package manager
- Show basic project metadata

### Project Metadata

The app should detect:

- Project name
- React version (and derived major: 16, 17, or 18)
- React DOM version
- Node version if available
- Package manager
- Git status
- Existing branch
- TypeScript availability
- Build scripts
- Test scripts

### Acceptance Criteria

- User can select a folder
- Invalid folders are rejected with clear reason
- Valid React projects move to next step
- No files are modified

---

## Phase 3: React 19 Compatibility Scanner

### Goal

Scan the selected project and identify **React 19 migration readiness**.

### Scanner Categories

The scanner should detect:

- React + React DOM versions (and derived source major: 16 / 17 / 18)
- Recommended React 19 migration track (`react-16-to-19`, `react-17-to-19`, or `react-18-to-19`)
- Deprecated / React-19-incompatible dependencies
- `react-scripts` version
- Webpack / Vite / custom build config
- Babel config and JSX transform mode
- TypeScript presence and `tsconfig` `jsx` mode
- JavaScript / JSX file count
- Class components
- Deprecated lifecycle methods (`componentWillMount`, `componentWillReceiveProps`, `componentWillUpdate`)
- React 19 API risks (`ReactDOM.render`, `findDOMNode`, string refs, legacy context, `propTypes` / `defaultProps` on function components)
- React Router version
- Redux usage
- Testing setup
- ESLint setup
- Build command
- Test command
- Lock file type
- Git cleanliness

### Output

The scanner should produce a structured report:

```ts
type ScanReport = {
  projectInfo: ProjectInfo;
  dependencies: DependencyReport;
  sourceAnalysis: SourceAnalysisReport;
  riskReport: RiskReport;
  recommendations: Recommendation[];
};
````

### Acceptance Criteria

* Scanner runs without modifying files
* Scanner produces a clear React 19 readiness report
* Risks are categorized as Low, Medium, High
* React-19-incompatible APIs and dependencies are highlighted
* Recommended React 19 migration track (`react-16-to-19`, `react-17-to-19`, `react-18-to-19`) is computed from the detected source major

---

## Phase 4: React 19 Migration Plan Generator

### Goal

Generate a step-by-step **React 19 migration plan** from the scan report and chosen migration track.

### Plan Strategy

The React 19 migration plan is **foundation-first, React-major-aware, and phase-based**.

Recommended phase order:

1. **preflight** — Node, package manager, Git, React version
2. **tooling** — build tool, TypeScript, ESLint, test runner
3. **react-18-bridge** — only for React 16 / 17 sources (`createRoot`, new JSX transform)
4. **api-compatibility** — `ReactDOM.render`, `findDOMNode`, string refs, legacy context, deprecated lifecycles, `propTypes` / `defaultProps`
5. **jsx-transform** — `tsconfig` / Babel / Vite alignment for React 19
6. **react-19-upgrade** — upgrade `react`, `react-dom`, and types to React 19
7. **source-modernization** — small, safe modernization (functional components, hooks, ref-as-prop)
8. **validation** — lint, typecheck, tests, build
9. **final-review** — generate React 19 migration summary

### Plan Step Structure

```ts
type MigrationStep = {
  id: string;
  title: string;
  description: string;
  category: "dependency" | "config" | "typescript" | "component" | "routing" | "validation";
  risk: "low" | "medium" | "high";
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  filesExpectedToChange?: string[];
  validationCommands?: string[];
};
```

### Acceptance Criteria

* React 19 plan is generated from scan report
* Plan reflects the selected React 19 migration track and phases
* User can review the plan
* User can approve the plan
* User can see step risk
* Plan is saved in migration session state

---

## Phase 5: Migration Workspace Creation

### Goal

Create a safe workspace before any code modification starts.

### Supported Strategies

V1 should support one primary strategy first:

```txt
Git worktree strategy
```

Fallback strategy:

```txt
Copy project to separate migration workspace
```

### Workspace Rules

* Original project must remain untouched
* Workspace path should be clearly shown
* Migration branch should be created
* Dirty git state should be detected before workspace creation
* User should confirm before workspace is created

### Acceptance Criteria

* Workspace is created successfully
* Migration branch is created
* Original project remains unchanged
* Workspace path is saved
* Failure messages are clear

---

## Phase 6: Execution Engine

### Goal

Execute one migration step at a time.

### Execution Flow

```txt
Select Step
↓
Prepare Context
↓
Run AI / Scripted Action
↓
Capture Logs
↓
Show Diff
↓
Run Validation
↓
Approve / Reject / Retry
↓
Update Session State
```

### Execution Requirements

* Only one step should run at a time
* Logs should stream to UI
* Errors should stop the current step
* User should always know what is happening
* Step result should be saved

### Acceptance Criteria

* A migration step can be executed
* Logs are visible
* Step status updates properly
* Failed steps can be retried
* User can continue to next step after approval

---

## Phase 7: Diff Review

### Goal

Allow users to review AI-generated changes before accepting them.

### Features

* Show changed files
* Show file-level diff
* Show added/removed line count
* Show risk summary
* Show AI explanation
* Approve changes
* Reject changes
* Retry step

### Acceptance Criteria

* User can see what changed
* User can approve or reject
* Rejected changes can be reverted
* Approved changes can be committed or marked accepted

---

## Phase 8: Validation System

### Goal

Run project validation commands after migration steps.

### Validation Commands

The app should detect and run available commands:

```txt
npm run lint
npm run typecheck
npm test
npm run build
```

Equivalent commands should be supported for:

* npm
* yarn
* pnpm

### Validation Result

```ts
type ValidationResult = {
  command: string;
  status: "passed" | "failed" | "skipped";
  output: string;
  durationMs: number;
};
```

### Acceptance Criteria

* Validation command runs in workspace
* Output is captured
* Failed validation is shown clearly
* User can retry after fixing

---

## Phase 9: Session State Management

### Goal

Persist migration progress so the user can continue later.

### Session Should Store

* Original project path
* Workspace path
* Scan report
* Migration plan
* Current step
* Step statuses
* Validation results
* Execution logs
* User approvals
* Error history

### Acceptance Criteria

* Session can be saved
* Session can be restored
* App reload does not lose migration progress
* Completed steps remain completed

---

## Phase 10: Settings

### Goal

Allow basic configuration for local execution.

### V1 Settings

* AI provider selection
* Model name
* Max context size
* Token/cost visibility toggle
* Default workspace location
* Auto-run validation toggle
* Git commit per step toggle
* Log retention setting

### Acceptance Criteria

* Settings screen exists
* Settings are persisted locally
* Execution engine reads settings

---

## Phase 11: React 19 Migration Summary Report

### Goal

Generate a clear **React 19 migration summary** at the end.

### Summary Should Include

* Project migrated
* Original React major (16 / 17 / 18) and exact starting versions
* Target: React 19 (final React + React DOM versions reached)
* Migration track used (`react-16-to-19`, `react-17-to-19`, `react-18-to-19`)
* Steps completed (grouped by React 19 phase)
* Steps skipped
* Failed steps
* Files changed
* Dependencies updated
* Validation results
* Remaining React 19 follow-ups (manual review, codemods, etc.)
* Final recommendation

### Acceptance Criteria

* Summary is generated
* Summary can be copied/exported
* User can understand what happened
* Remaining risks are clearly shown

---

# 5. Recommended Implementation Order

Build in this exact order:

## Milestone 1: Static UI Foundation

* App shell
* Routing
* Sidebar workflow
* Empty screens
* Shared UI components

## Milestone 2: Project Selection

* Folder picker
* Project metadata detection
* Basic validation

## Milestone 3: React 19 Compatibility Scanner

* package.json scanner
* dependency scanner (including React 19 peer-dep conflicts)
* source file scanner (deprecated lifecycles, `ReactDOM.render`, `findDOMNode`, string refs, legacy context)
* React 19 readiness report UI (with detected source major + recommended track)

## Milestone 4: React 19 Migration Plan

* Rule-based React 19 migration plan generator (track + phases)
* Plan review UI
* Approve plan action

## Milestone 5: Workspace

* Git status check
* Worktree creation
* Migration branch creation
* Workspace confirmation UI

## Milestone 6: Execution Engine

* Step runner
* Logs
* Status updates
* Error handling

## Milestone 7: Diff Review

* Changed files list
* Diff viewer
* Approve/reject flow

## Milestone 8: Validation

* Run lint/build/test/typecheck
* Show command output
* Save validation result

## Milestone 9: Session Persistence

* Save migration state
* Restore migration state

## Milestone 10: Final Polish

* UX improvements
* Error messages
* Performance checks
* Edge case handling
* Documentation update

---

# 6. What Not To Build in V1

Do not build these in V1:

* Login/authentication
* Team management
* Cloud dashboard
* SaaS billing
* Multi-user collaboration
* Enterprise admin panel
* Angular migration
* Vue migration
* Java backend migration
* Fully autonomous migration without review
* Marketplace
* Plugin system
* Analytics dashboard
* Remote project execution

These can be considered after the local React migration flow is stable.

---

# 7. Development Rules

## 7.1 No Big Bang Implementation

Do not implement many modules at once.

Each feature should be built, tested, and reviewed independently.

## 7.2 Keep Business Logic Separate

UI components should not directly contain scanning, git, AI, or execution logic.

Use separate service modules.

Recommended separation:

```txt
ui/
services/
core/
types/
store/
utils/
```

## 7.3 Prefer Typed Contracts

All scanner, planner, execution, and validation results should have TypeScript types.

## 7.4 Logs Are Mandatory

Any long-running action must produce logs.

Examples:

* scan started
* package.json found
* React version detected
* deprecated dependency found
* workspace creation started
* git worktree created
* validation failed

## 7.5 Every Destructive Action Requires Confirmation

Potentially destructive actions include:

* deleting workspace
* reverting changes
* resetting step
* removing generated files
* overwriting migration state

---

# 8. First Real Development Task

The first actual development task should be:

## Task 1: Build App Shell and Workflow Navigation

### Goal

Create the main application shell and workflow navigation for the migration journey.

### Required Screens

* Project Selection
* Scan Report
* Migration Plan
* Workspace Confirmation
* Execute Migration
* Final Summary
* Settings

### Requirements

* Use existing project architecture
* Use production-grade layout
* Keep UI fast and clean
* Do not add login
* Do not add unnecessary navbar links
* Show migration workflow in sidebar
* Each screen should have a clean empty state
* Use reusable components where suitable

### Acceptance Criteria

* App starts without error
* All workflow screens are reachable
* Sidebar clearly shows migration steps
* Active step is highlighted
* Completed, current, and locked states are visually supported
* No backend/scanner logic required yet

---

# 9. Cursor Prompt For First Development Task

Use this prompt in Cursor:

```txt
You are working on the Legacy Modernization Orchestrator project.

Before coding, read and follow these files:

- PROJECT_CONSTITUTION.md
- docs/DEV_PLAN_V1.md
- docs/ARCHITECTURE_V1.md

Now implement Milestone 1 only: Static UI Foundation.

Goal:
Create the main application shell and workflow navigation for the local-first React legacy modernization tool.

Important scope:
- Do not implement scanning logic yet.
- Do not implement AI execution yet.
- Do not implement workspace creation yet.
- Do not add login or authentication.
- Do not add cloud/team/SaaS features.
- Focus only on clean production-grade UI foundation.

Required screens:
1. Project Selection
2. Scan Report
3. Migration Plan
4. Workspace Confirmation
5. Execute Migration
6. Final Summary
7. Settings

Layout requirements:
- Left sidebar showing workflow steps.
- Main content area for selected screen.
- Header area showing current project/session status placeholder.
- Each screen should have a clear empty state.
- Active workflow step should be highlighted.
- Future/locked steps should look disabled.
- Completed steps should support a completed visual state, even if currently mocked.

Engineering requirements:
- Follow the existing folder structure.
- Use reusable components.
- Keep components small and maintainable.
- Use TypeScript types where needed.
- Avoid hardcoded scattered constants; keep workflow step config in one place.
- Keep styling consistent with the selected design system.
- Ensure the app remains fast and clean.

Output expected:
- Implement the required UI foundation.
- Create or update files as needed.
- Do not modify unrelated files.
- After implementation, provide:
  1. Files changed
  2. What was implemented
  3. How to run
  4. Any assumptions
```

```

---

# 10. Definition of Done for V1

V1 is done when:

- User can select a React 16, React 17, or React 18 project
- App can run the React 19 compatibility scan
- App can generate a React 19 migration plan with the correct track and phases
- App can create a safe workspace
- App can execute React 19 migration steps one by one
- User can review diffs
- User can approve / reject / retry steps
- App can run validation
- App can generate the React 19 migration summary
- Original project remains safe throughout the process

---

# 11. Final Direction

The project should now move from architecture thinking to milestone-based implementation against the React 19 migration target.

The immediate next action is the **Rework R1 — Product Rebaseline to React 19 Migration Pilot** milestone (this document), followed by Scanner V2 / Planner V2 / Executor V2 milestones.

Do not introduce new executors, AI execution, or workspace behavior changes inside R1 — R1 is documentation, terminology, and domain-type rebaseline only.
```