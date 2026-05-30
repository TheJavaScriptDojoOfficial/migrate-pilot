"""Validation runner.

Spawns the detected validation commands inside the workspace, streams their
output to disk + the event bus, and produces a structured
:class:`ValidationResult`.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class ValidationStatus(StrEnum):
    NOT_CONFIGURED = "NOT_CONFIGURED"
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    PASSED = "PASSED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass(frozen=True, slots=True)
class ValidationResult:
    """Outcome of one validation run."""

    status: ValidationStatus
    command: str
    exit_code: int | None
    duration_ms: int | None
    log_artifact_path: Path | None
    error_summary: str | None


class ValidationRunner:
    """Run validation commands with bounded resources."""

    async def run(
        self,
        workspace_path: Path,
        command: str,
    ) -> ValidationResult:
        """Run ``command`` inside ``workspace_path`` and capture the result."""
        raise NotImplementedError
