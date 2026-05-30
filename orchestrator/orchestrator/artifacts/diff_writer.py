"""Diff writer.

Captures the diff produced by an AI step (``git diff`` against the
pre-step base SHA) and writes it to ``patch.diff`` for review.
"""

from __future__ import annotations

from pathlib import Path


class DiffWriter:
    """Write step diffs to disk."""

    def write(
        self,
        session_id: str,
        step_id: str,
        workspace_path: Path,
        base_commit_sha: str,
    ) -> Path:
        """Capture the diff between ``base_commit_sha`` and the workspace HEAD."""
        raise NotImplementedError
