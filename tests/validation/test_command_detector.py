"""Placeholder tests for the validation command detector."""

from __future__ import annotations

import pytest

from orchestrator.validation.command_detector import CommandDetector, DetectedCommands


def test_detector_is_importable() -> None:
    assert CommandDetector is not None
    assert DetectedCommands is not None


@pytest.mark.skip(reason="Implementation pending")
def test_detect_reads_typecheck_lint_test_build_scripts() -> None:
    raise NotImplementedError
