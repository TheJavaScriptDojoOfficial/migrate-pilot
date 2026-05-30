"""Prompt builder.

Composes deterministic prompts for AI providers. See
``docs/prompts/ai-provider-guidelines.md`` for the constraints every prompt
must satisfy.

Rules:
    * Never include the full repository.
    * Include only the files the step explicitly needs.
    * Include the scan summary, current step description, constraints, and
      the required output format.
    * Exclude any file flagged sensitive by
      :mod:`orchestrator.scanner.dependency_scanner` or the redact list.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .provider_base import AITaskKind


@dataclass(frozen=True, slots=True)
class BuiltPrompt:
    """A prompt ready to be sent to an AI provider."""

    text: str
    included_files: tuple[Path, ...]


class PromptBuilder:
    """Build deterministic prompts for one task at a time."""

    def build(
        self,
        task: AITaskKind,
        *,
        step_description: str,
        scan_summary: str,
        candidate_files: tuple[Path, ...],
    ) -> BuiltPrompt:
        """Return a fully-formed prompt for ``task``."""
        raise NotImplementedError
