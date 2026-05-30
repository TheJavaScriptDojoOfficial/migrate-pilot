"""CLI entry point for the orchestrator sidecar.

The Tauri desktop shell spawns this process and communicates with it via
line-delimited JSON on stdin/stdout (see ``apps/desktop/src-tauri/src/process``).

TODO:
    * Parse ``--data-dir`` and ``--log-level`` flags.
    * Boot the event bus, session manager, and IPC dispatcher.
    * Install signal handlers for graceful shutdown.
"""

from __future__ import annotations

import sys


def main() -> int:
    """Process entry point. Returns the desired exit code."""
    # TODO: wire up the orchestrator runtime.
    sys.stderr.write("migrate-pilot-orchestrator: scaffold placeholder\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
