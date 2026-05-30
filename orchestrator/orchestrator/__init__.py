"""Migrate Pilot orchestration engine.

Local-first Python sidecar that runs scans, generates migration plans,
calls AI providers, applies steps inside a Git worktree, runs validations
and persists session state.

Public entry point: :mod:`orchestrator.__main__`.
"""

from __future__ import annotations

__version__ = "0.0.1"
