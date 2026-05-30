"""Append-only event bus.

Every meaningful state transition or log line is emitted as an immutable
event. Events are streamed to the UI via the Tauri layer (NDJSON over the
sidecar's stdout) and persisted to disk for replay.

The bus is intentionally small in V1 - no topic routing, no backpressure
beyond a bounded queue. Heavy subscribers (e.g. log aggregators) should
read from the on-disk NDJSON instead of subscribing live.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class EventKind(StrEnum):
    """Stable channel names mirrored in the Tauri events module."""

    SESSION_STATE_CHANGED = "session.state_changed"
    STEP_STATE_CHANGED = "step.state_changed"
    STEP_LOG_LINE = "step.log_line"
    AI_TOKEN = "ai.token"
    AI_COMPLETED = "ai.completed"
    VALIDATION_STARTED = "validation.started"
    VALIDATION_FINISHED = "validation.finished"
    GIT_COMMIT_CREATED = "git.commit_created"
    GIT_ROLLBACK_COMPLETED = "git.rollback_completed"
    ERROR_RAISED = "error.raised"


@dataclass(frozen=True, slots=True)
class Event:
    """A single event. ``payload`` must be JSON-serialisable and small."""

    id: str
    session_id: str
    kind: EventKind
    at: str
    step_id: str | None = None
    payload: dict[str, Any] | None = None


class EventBus:
    """In-process event bus. Synchronous publish, async sink expected."""

    def publish(self, event: Event) -> None:
        """Publish a single event to all subscribers."""
        raise NotImplementedError

    def publish_many(self, events: Iterable[Event]) -> None:
        """Publish a batch of events."""
        raise NotImplementedError
