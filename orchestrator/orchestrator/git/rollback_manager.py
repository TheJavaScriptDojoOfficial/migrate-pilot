"""Rollback manager.

Two rollback modes, both confined to the migration workspace:

* **Before commit** - hard reset + clean the workspace to the previous safe
  commit. Used when a step fails validation or is rejected.
* **After commit** - create a revert commit (or hard reset to a previous safe
  SHA, depending on user choice).

The original project is NEVER touched.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class RollbackMode(StrEnum):
    BEFORE_COMMIT = "BEFORE_COMMIT"
    AFTER_COMMIT_REVERT = "AFTER_COMMIT_REVERT"
    AFTER_COMMIT_RESET = "AFTER_COMMIT_RESET"


@dataclass(frozen=True, slots=True)
class RollbackResult:
    """Outcome of a rollback operation."""

    mode: RollbackMode
    new_head_sha: str
    summary: str


class RollbackManager:
    """Roll the migration workspace back to a safe state."""

    def rollback_uncommitted(self, workspace_path: Path) -> RollbackResult:
        """Hard reset and clean the workspace. Use before any commit exists."""
        raise NotImplementedError

    def revert_commit(self, workspace_path: Path, commit_sha: str) -> RollbackResult:
        """Create a revert commit for ``commit_sha``."""
        raise NotImplementedError

    def reset_to(self, workspace_path: Path, commit_sha: str) -> RollbackResult:
        """Hard reset the workspace branch to ``commit_sha``."""
        raise NotImplementedError
