"""Dataclass models persisted to SQLite.

Each dataclass mirrors one table in the local database. Keep the field
names aligned with the matching TypeScript types under
``apps/desktop/src/shared/types/``.
"""

from __future__ import annotations

from dataclasses import dataclass

from orchestrator.core.session_manager import SessionState
from orchestrator.core.workflow_engine import StepState


@dataclass(frozen=True, slots=True)
class ProjectRow:
    """``projects`` table row."""

    id: str
    name: str
    path: str
    remote_url: str | None
    base_branch: str | None
    registered_at: str
    last_opened_at: str | None


@dataclass(frozen=True, slots=True)
class SessionRow:
    """``sessions`` table row."""

    id: str
    project_id: str
    state: SessionState
    label: str | None
    branch_name: str | None
    workspace_path: str | None
    created_at: str
    updated_at: str
    completed_at: str | None


@dataclass(frozen=True, slots=True)
class StepRow:
    """``migration_steps`` table row."""

    id: str
    session_id: str
    order: int
    title: str
    description: str
    state: StepState
    risk: str
    commit_sha: str | None
    started_at: str | None
    completed_at: str | None


@dataclass(frozen=True, slots=True)
class ArtifactRow:
    """``artifacts`` table row. Large content lives on disk."""

    id: str
    session_id: str
    step_id: str | None
    relative_path: str
    kind: str
    created_at: str
