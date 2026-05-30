"""Git worktree manager.

Creates and removes isolated worktrees so AI execution can never touch the
original project's working tree.

Workspace path layout (see docs/architecture/folder-structure.md):
    ~/LegacyModernizer/workspaces/{project-name}/{session-id}
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Worktree:
    """A live Git worktree on disk."""

    path: Path
    branch_name: str
    base_commit_sha: str


class WorktreeManager:
    """Create / remove Git worktrees for migration sessions."""

    def create(
        self,
        repo_path: Path,
        workspace_path: Path,
        branch_name: str,
        base_branch: str,
    ) -> Worktree:
        """Create a new worktree at ``workspace_path`` on a fresh branch."""
        raise NotImplementedError

    def remove(self, repo_path: Path, workspace_path: Path) -> None:
        """Remove the worktree and clean up its administrative files."""
        raise NotImplementedError
