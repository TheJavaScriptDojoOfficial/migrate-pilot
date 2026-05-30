# Migrate Pilot Orchestrator

Local Python orchestration engine for Migrate Pilot.

## Layout

| Package | Responsibility |
| --- | --- |
| `orchestrator.core` | Session manager, workflow engine, event bus |
| `orchestrator.scanner` | Project / dependency / risk scanners |
| `orchestrator.git` | Git, worktree, branch, rollback managers |
| `orchestrator.ai` | Provider adapters, prompt builder, cost tracker |
| `orchestrator.planner` | Migration plan generator + step builder |
| `orchestrator.validation` | Command detector + validation runner |
| `orchestrator.state` | SQLite handle + dataclass models |
| `orchestrator.artifacts` | Log / diff / artifact writers |

## Dev install

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .[dev]
```

## Run

```bash
python -m orchestrator
```
