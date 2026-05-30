# Tests

Test suites for Migrate Pilot, organised by orchestrator subsystem.

| Folder | Covers |
| --- | --- |
| `scanner/` | `orchestrator.scanner.*` - project, dependency, risk scanners |
| `git/` | `orchestrator.git.*` - worktree, branch, rollback managers |
| `workflow/` | `orchestrator.core.*` and `orchestrator.planner.*` - state machine + plan generation |
| `validation/` | `orchestrator.validation.*` - command detection and execution |

Run all tests from the repo root:

```bash
cd orchestrator && pytest ../tests
```
