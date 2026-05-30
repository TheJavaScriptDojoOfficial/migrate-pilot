# Legacy Modernization Orchestrator — Project Constitution

## 1. Project Identity

**Project Name:** Legacy Modernization Orchestrator  
**Project Type:** Local-first AI-human orchestration tool  
**Initial Target:** Legacy React applications  
**V1 Focus:** React 16 / React 17 modernization to a safer, cleaner, more maintainable React + TypeScript codebase  
**Primary User:** Developer, Tech Lead, Frontend Lead, Solution Architect, or modernization team member  
**Execution Style:** AI executes step-by-step, human reviews and approves important decisions  

---

## 2. Product Goal

The goal of this project is to reduce the manual effort, risk, and uncertainty involved in modernizing legacy React projects.

The application should help users:

- Scan an existing legacy React project.
- Detect outdated dependencies, deprecated libraries, risky patterns, and migration blockers.
- Generate a clear modernization report.
- Create a safe migration plan.
- Create an isolated migration workspace.
- Execute migration steps one by one.
- Review code changes after each step.
- Validate each step through linting, type-checking, tests, and build checks.
- Keep the human in control before risky changes are accepted.

The product is not just a code converter. It is a controlled modernization workflow system.

---

## 3. Core Problem Being Solved

Legacy frontend modernization is painful because teams usually face these problems:

- Old React projects contain deprecated dependencies.
- Libraries such as `node-sass`, old routing libraries, class components, old lifecycle methods, outdated build tools, and old testing setups create upgrade friction.
- Manual migration takes time and requires repeated investigation.
- AI tools can generate changes quickly, but without structure they may create risky, inconsistent, or unreviewed code.
- Developers need visibility into what changed, why it changed, and whether the project still works.
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

Migration should happen through small, reviewable steps such as:

- Replace deprecated dependency.
- Add TypeScript configuration.
- Convert utility files.
- Convert simple components.
- Convert feature-level pages.
- Update React Router usage.
- Fix deprecated lifecycle methods.
- Improve build/test setup.

### 4.3 Foundation-First Migration

The recommended migration strategy is foundation-first, not screen-flow-first.

Preferred order:

1. Project scan and dependency analysis.
2. Create migration workspace.
3. Upgrade or replace deprecated foundations.
4. Add TypeScript support where applicable.
5. Convert low-risk files first.
6. Convert reusable UI components.
7. Convert pages and feature modules.
8. Update routing/state patterns.
9. Run validation.
10. Generate final migration summary.

Screen-flow migration, such as starting from login and then moving page by page, should only be used later when the foundation is stable.

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

V1 supports:

- React 16 projects
- React 17 projects
- JavaScript-based React projects
- React projects using old dependencies
- React projects that may need TypeScript migration
- Projects using deprecated packages such as `node-sass`

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

### 9.2 Project Scan

Purpose:

- Analyze the project structure, dependencies, scripts, and risk areas.

Should detect:

- React version
- Deprecated dependencies
- `node-sass` usage
- Old routing library usage
- JavaScript/TypeScript status
- Test setup
- Build tool
- Package manager
- Git branch status
- Potential migration blockers

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

### 9.4 Migration Plan

Purpose:

- Show the AI-generated step-by-step migration strategy.
- Let the user review, approve, edit, or reject the plan.

Should show:

- Migration strategy
- Total steps
- Risk per step
- Files/modules likely affected
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

### 9.6 Execution

Purpose:

- Execute migration steps one by one.

Should show:

- Current step
- Step status
- AI activity logs
- Files changed
- Token/cost estimate if available
- Validation result
- Retry/fix option

### 9.7 Diff Review

Purpose:

- Let the user review AI-generated changes before accepting.

Should show:

- Changed files
- Inline or side-by-side diff
- Step summary
- AI explanation
- Accept / Reject / Request Fix actions

### 9.8 Final Summary

Purpose:

- Show what was migrated and what remains.

Should show:

- Completed steps
- Skipped steps
- Failed steps
- Commits created
- Dependencies changed
- Validation summary
- Remaining recommendations

---

## 10. Migration Strategy

The default migration strategy is foundation-first.

Recommended example sequence:

1. Create safe migration workspace.
2. Detect package manager and install baseline dependencies.
3. Replace deprecated `node-sass` with `sass` if applicable.
4. Add or prepare TypeScript configuration.
5. Add type dependencies where needed.
6. Convert simple utility files to TypeScript.
7. Convert shared constants and helper files.
8. Convert simple UI components to TSX.
9. Convert reusable components such as Button, Card, Modal, Input.
10. Convert low-risk pages.
11. Convert feature modules.
12. Fix deprecated lifecycle methods.
13. Update routing patterns if needed.
14. Improve lint/type/build validation.
15. Run final validation.
16. Generate final report.

The system should not blindly follow this list. It should generate a project-specific plan based on scan results.

---

## 11. Deprecated Dependency Strategy

The migration must handle deprecated libraries carefully.

For example, if a React 17 project uses `node-sass`, the system should recommend replacing it with the modern `sass` package.

Expected behavior:

- Detect deprecated dependency.
- Explain why it is a risk.
- Identify compatible replacement.
- Plan replacement as a separate migration step.
- Update package file.
- Validate build after replacement.
- Keep style behavior unchanged as much as possible.

Important rule:

Dependency replacement must not be bundled with large unrelated code changes.

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

Use predictable branch names.

Example:

```text
migration/react-modernization-{timestamp}
```

or

```text
migration/{project-name}-react-upgrade
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

## 14. Scanner Strategy

The scanner must provide deterministic project understanding before AI execution starts.

The scanner should inspect:

- `package.json`
- Lock files
- React version
- Build tool
- Package manager
- Scripts
- TypeScript presence
- Sass/SCSS setup
- Deprecated packages
- Routing library
- State management library
- Test setup
- Folder structure
- Git status
- Existing lint/type/build commands

Scanner output should be structured and reusable by AI agents.

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
chore: replace node-sass with sass
chore: add TypeScript configuration
refactor: convert utility helpers to TypeScript
refactor: convert shared Button component to TSX
fix: update deprecated React lifecycle usage
```

Commit messages should be generated based on the actual step and changed files.

---

## 19. Reporting Strategy

The app should generate reports that are useful to both developers and leads.

### 19.1 Scan Report

Includes:

- Project metadata
- Dependencies
- Deprecated packages
- Risk areas
- Migration readiness
- Suggested strategy

### 19.2 Migration Plan Report

Includes:

- Step-by-step plan
- Risk rating
- Expected files/modules affected
- Validation method
- Human approval points

### 19.3 Final Summary Report

Includes:

- What changed
- What passed
- What failed
- What was skipped
- What remains
- Suggested next phase

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

- Select a local React 16/17 project.
- Scan the project.
- Detect major modernization risks.
- Detect deprecated dependencies such as `node-sass`.
- Generate a readiness report.
- Generate a migration plan.
- Create a safe migration workspace.
- Execute at least one migration step through AI or scripted automation.
- Show changed files and diff.
- Allow user approval or rejection.
- Run validation command.
- Track migration session state.
- Generate final summary report.

---

## 25. V1 Limitations

V1 should openly communicate its limitations.

Expected limitations:

- It may not fully migrate every project automatically.
- Some code changes may require manual review.
- Some validations may not be available in older projects.
- Complex dependency upgrades may need manual decisions.
- Visual regression testing may not be available initially.
- It focuses only on React legacy modernization.
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

### Step 9: Implement One End-to-End Migration Step

Start with a simple but valuable step:

```text
Replace node-sass with sass
```

This is a good first real migration step because it is common, valuable, and bounded.

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
A user can select a React 17 project using node-sass, scan it, get a readiness report, create a migration workspace, replace node-sass with sass, review the diff, run build validation, and generate a summary.
```

This milestone proves the full product loop.

It is better than building many screens without one working end-to-end workflow.

---

## 29. AI Instruction for Future Work

Any AI assistant, Cursor agent, or coding agent working on this project should read this constitution first.

Before making changes, the AI should understand:

- This is a local-first legacy React modernization orchestrator.
- V1 is focused only on React 16/17 projects.
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

> Help development teams modernize legacy React applications safely, one validated step at a time, with AI doing the heavy lifting and humans staying in control.

