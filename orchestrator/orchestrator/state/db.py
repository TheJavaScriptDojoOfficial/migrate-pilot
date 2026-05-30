"""SQLite database handle.

Owns the connection, applies migrations on startup, and exposes typed
helpers used by the rest of the orchestrator. WAL mode is enabled for
better local read/write concurrency.

Tables (see docs/architecture/folder-structure.md):
    projects, sessions, scan_reports, migration_plans, migration_steps,
    execution_events, artifacts, approvals, validation_runs, git_commits,
    provider_runs, settings.
"""

from __future__ import annotations

from contextlib import contextmanager
from collections.abc import Iterator
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import sqlite3


class Database:
    """Owns a single SQLite connection. Not thread-safe."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        # TODO: open connection, enable WAL, run migrations.

    def connect(self) -> "sqlite3.Connection":
        """Open and return the underlying SQLite connection."""
        raise NotImplementedError

    @contextmanager
    def transaction(self) -> Iterator["sqlite3.Connection"]:
        """Context manager that commits on success and rolls back on error."""
        raise NotImplementedError
        yield  # pragma: no cover - satisfies contextmanager typing

    def close(self) -> None:
        """Close the connection."""
        raise NotImplementedError
