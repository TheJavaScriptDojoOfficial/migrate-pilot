"""Placeholder tests for the project scanner.

Real tests will be added when ``ProjectScanner.quick_scan`` is implemented.
"""

from __future__ import annotations

import pytest

from orchestrator.scanner.project_scanner import ProjectScanner


def test_project_scanner_is_importable() -> None:
    """Smoke test - module imports cleanly. Replace with real coverage."""
    assert ProjectScanner is not None


@pytest.mark.skip(reason="Implementation pending")
def test_quick_scan_detects_package_manager() -> None:
    raise NotImplementedError
