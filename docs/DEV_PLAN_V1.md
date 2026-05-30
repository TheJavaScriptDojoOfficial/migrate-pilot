# Migrate Pilot — V1 Development Plan

## 1. Current Status

The base architecture and initial project structure are completed.

The project now has:

- V1 architecture blueprint
- Project constitution
- Base folder structure
- Initial product direction
- Local-first scope
- React legacy modernization as the V1 focus

The next phase is controlled implementation.

---

## 2. V1 Development Goal

Build a local-first migration orchestration application that helps users migrate old React projects step by step with AI assistance and human review.

V1 should support:

- Selecting a local React project
- Scanning the project
- Detecting migration readiness
- Creating a safe migration workspace
- Generating a migration plan
- Executing migration steps one by one
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

Migration should happen in small controlled steps.

Example:

1. Replace deprecated packages
2. Add TypeScript config
3. Convert simple utilities
4. Convert simple components
5. Convert shared components
6. Convert pages
7. Fix routing
8. Fix deprecated React APIs
9. Run validation
10. Generate final summary

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

Allow the user to select a local React project safely.

### Features

- Select project folder
- Show selected path
- Detect package.json
- Detect git repository
- Detect React dependency
- Detect package manager
- Show basic project metadata

### Project Metadata

The app should detect:

- Project name
- React version
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

## Phase 3: Readiness Scanner

### Goal

Scan the selected project and identify migration readiness.

### Scanner Categories

The scanner should detect:

- React version
- Deprecated dependencies
- node-sass usage
- react-scripts version
- webpack/custom config
- Babel config
- TypeScript presence
- JavaScript/JSX file count
- Class components
- Deprecated lifecycle methods
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
* Scanner produces clear report
* Risks are categorized as Low, Medium, High
* Deprecated libraries are highlighted
* node-sass replacement recommendation is shown when applicable

---

## Phase 4: Migration Plan Generator

### Goal

Generate a step-by-step migration plan from the scan report.

### Plan Strategy

The migration plan should follow a foundation-first approach.

Recommended order:

1. Workspace safety setup
2. Dependency modernization
3. Build tooling compatibility
4. TypeScript preparation
5. Utility conversion
6. Shared component conversion
7. Page/module conversion
8. Router modernization
9. State management cleanup
10. Deprecated API fixes
11. Validation
12. Final report

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

* Plan is generated from scan report
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

## Phase 11: Final Summary Report

### Goal

Generate a clear migration summary at the end.

### Summary Should Include

* Project migrated
* Original React version
* Target modernization changes
* Steps completed
* Steps skipped
* Failed steps
* Files changed
* Dependencies updated
* Validation results
* Remaining manual actions
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

## Milestone 3: Scanner

* package.json scanner
* dependency scanner
* source file scanner
* readiness report UI

## Milestone 4: Migration Plan

* Rule-based migration plan generator
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

- User can select an old React project
- App can scan the project
- App can generate a migration plan
- App can create a safe workspace
- App can execute migration steps one by one
- User can review diffs
- User can approve/reject/retry steps
- App can run validation
- App can generate final summary
- Original project remains safe throughout the process

---

# 11. Final Direction

The project should now move from architecture thinking to milestone-based implementation.

The immediate next action is:

> Implement Milestone 1: Static UI Foundation.

Do not start scanner, AI execution, or git automation before the workflow UI foundation is stable.
```