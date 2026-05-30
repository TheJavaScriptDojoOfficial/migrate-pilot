"""Placeholder tests for session state transitions."""

from __future__ import annotations

import pytest

from orchestrator.core.session_manager import SessionState, TERMINAL_SESSION_STATES


def test_terminal_states_are_well_defined() -> None:
    assert SessionState.COMPLETED in TERMINAL_SESSION_STATES
    assert SessionState.CANCELLED in TERMINAL_SESSION_STATES


@pytest.mark.skip(reason="Implementation pending")
def test_transition_to_invalid_state_is_rejected() -> None:
    raise NotImplementedError
