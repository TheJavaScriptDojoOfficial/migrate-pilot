"""Session lifecycle management.

A migration session represents one attempt to migrate a single project.
The :class:`SessionManager` owns the session-level state machine and is the
single writer for session rows in SQLite.

Mirror of the TypeScript enum in
``apps/desktop/src/shared/constants/sessionStates.ts``.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class SessionState(StrEnum):
    """Canonical session-level state machine. Keep aligned with the UI enum."""

    DRAFT = "DRAFT"
    PROJECT_SELECTED = "PROJECT_SELECTED"
    SCANNING = "SCANNING"
    SCAN_COMPLETED = "SCAN_COMPLETED"
    PLAN_GENERATED = "PLAN_GENERATED"
    PLAN_APPROVED = "PLAN_APPROVED"
    WORKSPACE_CREATING = "WORKSPACE_CREATING"
    WORKSPACE_READY = "WORKSPACE_READY"
    EXECUTING_STEP = "EXECUTING_STEP"
    STEP_EXECUTED = "STEP_EXECUTED"
    AWAITING_DIFF_REVIEW = "AWAITING_DIFF_REVIEW"
    VALIDATING = "VALIDATING"
    STEP_APPROVED = "STEP_APPROVED"
    STEP_COMMITTED = "STEP_COMMITTED"
    STEP_FAILED = "STEP_FAILED"
    ROLLING_BACK = "ROLLING_BACK"
    ROLLED_BACK = "ROLLED_BACK"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


TERMINAL_SESSION_STATES: frozenset[SessionState] = frozenset(
    {SessionState.COMPLETED, SessionState.CANCELLED}
)


@dataclass(frozen=True, slots=True)
class SessionSnapshot:
    """Immutable view of a session at a point in time."""

    id: str
    project_id: str
    state: SessionState
    branch_name: str | None
    workspace_path: str | None
    created_at: str
    updated_at: str
    completed_at: str | None


class SessionManager:
    """Single-writer for session state.

    Transitions are explicit: callers request a transition and the manager
    validates that it is allowed before persisting it. All persistence goes
    through :mod:`orchestrator.state.db`.
    """

    def __init__(self) -> None:
        # TODO: accept a database handle and an event bus.
        ...

    def create(self, project_id: str) -> SessionSnapshot:
        """Create a new DRAFT session for the given project."""
        raise NotImplementedError

    def transition(self, session_id: str, target: SessionState) -> SessionSnapshot:
        """Transition a session to ``target`` if the move is allowed."""
        raise NotImplementedError

    def get(self, session_id: str) -> SessionSnapshot:
        """Read the current snapshot for ``session_id``."""
        raise NotImplementedError
