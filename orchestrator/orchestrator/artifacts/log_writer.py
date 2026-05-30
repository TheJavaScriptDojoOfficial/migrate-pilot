"""Append-only log writer.

Streams stdout/stderr from subprocesses (AI provider, validation commands)
into a per-step log file. Used by the event bus to also persist NDJSON
event streams.
"""

from __future__ import annotations

from pathlib import Path


class LogWriter:
    """Append lines to a per-step log file."""

    def __init__(self, log_path: Path) -> None:
        self.log_path = log_path

    def append(self, line: str) -> None:
        """Append a single line. Flushed immediately."""
        raise NotImplementedError

    def close(self) -> None:
        """Flush + close the underlying file handle."""
        raise NotImplementedError
