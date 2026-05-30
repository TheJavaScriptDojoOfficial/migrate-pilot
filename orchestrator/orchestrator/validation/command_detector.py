"""Validation command detector.

Reads ``package.json`` scripts to detect which validation commands are
available (typecheck, lint, test, build). Never invents commands - if a
script is missing, validation for that level is reported as
``NOT_CONFIGURED`` and surfaced to the user.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class DetectedCommands:
    """Validation commands resolved from package.json."""

    typecheck: str | None
    lint: str | None
    test: str | None
    build: str | None


class CommandDetector:
    """Detect validation commands for a given workspace."""

    def detect(self, workspace_path: Path) -> DetectedCommands:
        """Read ``package.json`` and return the available commands."""
        raise NotImplementedError
