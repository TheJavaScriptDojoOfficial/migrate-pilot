"""Placeholder tests for the worktree manager."""

from __future__ import annotations

import pytest

from orchestrator.git.worktree_manager import WorktreeManager


def test_worktree_manager_is_importable() -> None:
    assert WorktreeManager is not None


@pytest.mark.skip(reason="Implementation pending")
def test_create_workspace_refuses_existing_path() -> None:
    raise NotImplementedError


@pytest.mark.skip(reason="Implementation pending")
def test_create_workspace_refuses_existing_branch() -> None:
    raise NotImplementedError
