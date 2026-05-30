"""Generic artifact writer.

Wraps file-system writes so all artifacts go through a single path-validated
entry point. Used by the more specific writers in this package.

Rules:
    * All writes are confined to the session's artifact directory.
    * Writes are atomic (write to tmp, then rename).
    * File names are validated; arbitrary user-supplied paths are rejected.
"""

from __future__ import annotations

from pathlib import Path


class ArtifactWriter:
    """Write artifacts atomically under a session's directory."""

    def __init__(self, sessions_root: Path) -> None:
        self.sessions_root = sessions_root

    def write_text(self, session_id: str, relative_path: str, content: str) -> Path:
        """Write ``content`` to ``sessions_root/<session>/relative_path``."""
        raise NotImplementedError

    def write_json(self, session_id: str, relative_path: str, payload: object) -> Path:
        """Serialise ``payload`` to JSON and write atomically."""
        raise NotImplementedError
