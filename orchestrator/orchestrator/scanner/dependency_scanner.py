"""Dependency scanner.

Reads the project's package manifest and lockfile to produce a normalised
dependency summary. Flags packages known to complicate migration (e.g.
deprecated React companion libraries, ancient transitive deps).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class DependencySummary:
    """One dependency, normalised across npm/yarn/pnpm."""

    name: str
    version: str
    dev_only: bool
    risk_reason: str | None = None


class DependencyScanner:
    """Read package.json + lockfile and produce a dependency summary."""

    def __init__(self, project_path: Path) -> None:
        self.project_path = project_path

    def scan(self) -> list[DependencySummary]:
        """Return the full dependency list with risk annotations."""
        raise NotImplementedError
