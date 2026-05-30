"""Migration plan generator.

Converts a :class:`ScanReport`-equivalent into a step-by-step migration plan.

V1 strategy (in order, see docs/architecture/folder-structure.md):
    1. Add TypeScript configuration
    2. Add TypeScript dependencies
    3. Add base type declarations
    4. Convert simple utility files
    5. Convert shared constants/config files
    6. Convert simple stateless UI components
    7. Convert reusable components
    8. Convert form components
    9. Convert route-level pages
    10. Convert class components
    11. Fix deprecated lifecycle methods
    12. Update React Router usage if needed
    13. Run final validation
    14. Generate migration summary

Rules:
    * Steps must be small enough for a human to review comfortably.
    * Each step carries its own validation command(s) and risk level.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MigrationPlan:
    """A complete, ordered plan for a single session."""

    session_id: str
    step_ids: tuple[str, ...]


class MigrationPlanGenerator:
    """Produce a MigrationPlan from scan results."""

    def generate(self, session_id: str) -> MigrationPlan:
        """Build the plan for ``session_id`` using its scan artifacts."""
        raise NotImplementedError
