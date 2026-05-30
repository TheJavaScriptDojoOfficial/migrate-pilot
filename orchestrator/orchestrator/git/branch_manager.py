"""Branch helper.

Generates migration branch names and resolves conflicts (e.g. when a branch
already exists). Branch naming convention:
    migration/react-ts/session-NNN
"""

from __future__ import annotations

from pathlib import Path


class BranchManager:
    """Resolve, validate, and create migration branches."""

    def suggest_branch_name(self, session_id: str) -> str:
        """Return the recommended migration branch name for a session."""
        raise NotImplementedError

    def ensure_unique(self, repo_path: Path, branch_name: str) -> str:
        """Suffix the name if a branch with the same name already exists."""
        raise NotImplementedError
