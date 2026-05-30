"""AI provider adapter contract.

V1 follows a strict adapter pattern. Every provider (OpenCode CLI, future
Cursor CLI, future direct API providers, etc.) implements :class:`AIProvider`.

Safety rules for every implementation:
    * Must not write outside the supplied workspace directory.
    * Must not run destructive shell commands.
    * Must not delete files unless the step explicitly allows it.
    * Must produce structured output (changed-files list + summary).
    * Every prompt and response must be persisted as an artifact.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Protocol


class AITaskKind(StrEnum):
    PROJECT_SUMMARY = "PROJECT_SUMMARY"
    SCAN_INTERPRETATION = "SCAN_INTERPRETATION"
    PLAN_GENERATION = "PLAN_GENERATION"
    STEP_IMPLEMENTATION = "STEP_IMPLEMENTATION"
    AI_REVIEW = "AI_REVIEW"
    AUTO_FIX = "AUTO_FIX"
    VALIDATION_ANALYSIS = "VALIDATION_ANALYSIS"
    SUMMARY_GENERATION = "SUMMARY_GENERATION"


@dataclass(frozen=True, slots=True)
class AITaskInput:
    """Input to an AI provider task."""

    task: AITaskKind
    workspace_path: Path
    prompt: str
    context_files: tuple[Path, ...] = ()


@dataclass(frozen=True, slots=True)
class AITaskResult:
    """Final outcome of a single AI task."""

    changed_files: tuple[Path, ...]
    summary: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    cost_usd: float | None = None


@dataclass(frozen=True, slots=True)
class AIEvent:
    """A streaming event emitted while a task is running."""

    kind: str
    data: str


@dataclass(frozen=True, slots=True)
class CostEstimate:
    """Rough cost preview for a task."""

    estimated_cost_usd: float
    estimated_prompt_tokens: int
    estimated_completion_tokens: int


class AIProvider(Protocol):
    """Adapter contract for all AI execution providers."""

    id: str
    name: str

    async def run_task(self, payload: AITaskInput) -> AITaskResult:
        """Run a task to completion and return its final result."""
        ...

    async def stream_task(self, payload: AITaskInput) -> AsyncIterator[AIEvent]:
        """Run a task and yield events as they arrive."""
        ...

    async def estimate_cost(self, payload: AITaskInput) -> CostEstimate | None:
        """Return a rough cost estimate if the provider supports one."""
        ...
