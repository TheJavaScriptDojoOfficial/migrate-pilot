"""Workflow engine.

Drives a session forward by selecting the next runnable step, invoking the
right subsystem (scanner, planner, AI provider, validator), and applying the
result back to session/step state.

Mirror of the TypeScript step enum in
``apps/desktop/src/shared/constants/stepStates.ts``.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class StepState(StrEnum):
    """Per-step state machine. Keep aligned with the UI enum."""

    PENDING = "PENDING"
    READY = "READY"
    RUNNING = "RUNNING"
    AI_COMPLETED = "AI_COMPLETED"
    DIFF_READY = "DIFF_READY"
    VALIDATION_RUNNING = "VALIDATION_RUNNING"
    VALIDATION_PASSED = "VALIDATION_PASSED"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FIX_REQUESTED = "FIX_REQUESTED"
    COMMITTED = "COMMITTED"
    ROLLED_BACK = "ROLLED_BACK"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


TERMINAL_STEP_STATES: frozenset[StepState] = frozenset(
    {
        StepState.COMMITTED,
        StepState.ROLLED_BACK,
        StepState.FAILED,
        StepState.SKIPPED,
        StepState.REJECTED,
    }
)


@dataclass(frozen=True, slots=True)
class StepSnapshot:
    """Immutable view of a step at a point in time."""

    id: str
    session_id: str
    order: int
    title: str
    state: StepState


class WorkflowEngine:
    """Selects the next step and orchestrates its lifecycle."""

    def __init__(self) -> None:
        # TODO: depend on SessionManager, AI provider, ValidationRunner,
        # GitManager, ArtifactWriter and EventBus.
        ...

    def next_runnable_step(self, session_id: str) -> StepSnapshot | None:
        """Return the next step eligible to run, or None if nothing is ready."""
        raise NotImplementedError

    def execute_step(self, session_id: str, step_id: str) -> StepSnapshot:
        """Run the AI implementation phase for ``step_id``."""
        raise NotImplementedError

    def apply_approval(self, session_id: str, step_id: str) -> StepSnapshot:
        """Apply a human approval to a step (commit + advance state)."""
        raise NotImplementedError
