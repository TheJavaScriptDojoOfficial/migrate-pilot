"""OpenCode CLI provider.

V1's primary AI execution adapter. Spawns the OpenCode CLI as a subprocess
inside the migration workspace, streams its stdout, and parses its output
into structured :class:`~orchestrator.ai.provider_base.AITaskResult` values.

TODO:
    * Detect the OpenCode binary; require user-configurable path.
    * Refuse to spawn if cwd is not inside the migration workspace.
    * Stream events through the event bus.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from .provider_base import AIEvent, AIProvider, AITaskInput, AITaskResult, CostEstimate


class OpenCodeProvider(AIProvider):
    """AI provider backed by the OpenCode CLI."""

    id = "opencode-cli"
    name = "OpenCode CLI"

    async def run_task(self, payload: AITaskInput) -> AITaskResult:
        raise NotImplementedError

    async def stream_task(self, payload: AITaskInput) -> AsyncIterator[AIEvent]:
        raise NotImplementedError
        yield  # pragma: no cover - satisfies AsyncIterator typing

    async def estimate_cost(self, payload: AITaskInput) -> CostEstimate | None:
        return None
