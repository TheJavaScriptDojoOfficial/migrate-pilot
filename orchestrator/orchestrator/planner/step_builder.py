"""Step builder.

Pure helpers for constructing individual migration steps with their risk
level, predicted target files, and validation commands.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True, slots=True)
class StepBlueprint:
    """A step definition before it is persisted to SQLite."""

    title: str
    description: str
    risk: RiskLevel
    target_files: tuple[Path, ...]
    validation_commands: tuple[str, ...]


class StepBuilder:
    """Build :class:`StepBlueprint` values for the plan generator."""

    def utility_to_typescript(self, files: tuple[Path, ...]) -> StepBlueprint:
        """Build a 'convert utility files to TypeScript' step."""
        raise NotImplementedError
