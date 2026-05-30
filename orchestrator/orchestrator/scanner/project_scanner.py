"""Project scanner.

Walks the selected React project to detect package manager, build tool,
React version, TypeScript presence, routing, state libraries, test setup,
lint setup, and file inventory.

Performance rules
-----------------
* Ignore ``node_modules``, ``dist``, ``build``, ``.git``, ``coverage`` and
  generated folders aggressively.
* Prefer cheap metadata scans (manifest files) before walking the source tree.
* Cache scan results per project path + Git commit SHA.
* Never read large binary files.
* Never forward raw source code to AI providers during scanning.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class ProjectMetadata:
    """Cheap, manifest-derived project metadata."""

    package_manager: str
    build_tool: str
    react_version: str | None
    has_typescript: bool
    has_tests: bool
    has_lint: bool


@dataclass(frozen=True, slots=True)
class FileInventory:
    """Counts of source files by extension category."""

    js: int = 0
    jsx: int = 0
    ts: int = 0
    tsx: int = 0
    css_like: int = 0
    tests: int = 0
    other: int = 0


class ProjectScanner:
    """Top-level scanner orchestrator. Composes the cheaper sub-scanners."""

    def __init__(self, project_path: Path) -> None:
        self.project_path = project_path

    def quick_scan(self) -> ProjectMetadata:
        """Read package.json and config files. Cheap, no file walking."""
        raise NotImplementedError

    def deep_scan(self) -> FileInventory:
        """Walk the source tree and compute the file inventory."""
        raise NotImplementedError
