"""Thin Git wrapper.

Centralises subprocess calls to ``git``. Other managers (worktree, branch,
rollback) delegate here so we have a single audit point for what we run
against the user's repository.

Safety rules
------------
* The original repository is read-only. Mutating commands targeting the
  original project path must be refused at this layer.
* All write operations require an explicit workspace path.
* Commands are invoked with structured arguments - never via ``shell=True``.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class GitStatus:
    """Output of ``git status --porcelain`` parsed into a small struct."""

    is_clean: bool
    current_branch: str | None


class GitManager:
    """Run ``git`` commands safely."""

    def status(self, repo_path: Path) -> GitStatus:
        """Return the working tree status for ``repo_path``."""
        raise NotImplementedError

    def get_head_sha(self, repo_path: Path) -> str:
        """Return the SHA of HEAD."""
        raise NotImplementedError

    def branch_exists(self, repo_path: Path, branch_name: str) -> bool:
        """Check whether ``branch_name`` exists in the repository."""
        raise NotImplementedError
