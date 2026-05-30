"""AI cost tracker.

Records token usage and cost per AI run so the UI can show a session-level
total. Costs are stored alongside provider runs in SQLite.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CostSnapshot:
    """Aggregated cost view for a session."""

    prompt_tokens: int
    completion_tokens: int
    total_cost_usd: float


class CostTracker:
    """Record AI usage and aggregate it per session."""

    def record(
        self,
        session_id: str,
        *,
        provider_id: str,
        prompt_tokens: int,
        completion_tokens: int,
        cost_usd: float,
    ) -> None:
        """Persist a single usage record."""
        raise NotImplementedError

    def snapshot(self, session_id: str) -> CostSnapshot:
        """Return the aggregated cost view for ``session_id``."""
        raise NotImplementedError
