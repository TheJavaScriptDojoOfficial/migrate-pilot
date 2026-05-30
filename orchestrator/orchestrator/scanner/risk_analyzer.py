"""Risk analyzer.

Consumes project metadata + dependency summary + file inventory and produces
a single composite risk score plus recommendations for the planner.
"""

from __future__ import annotations

from dataclasses import dataclass

from .dependency_scanner import DependencySummary
from .project_scanner import FileInventory, ProjectMetadata


@dataclass(frozen=True, slots=True)
class RiskAssessment:
    """Outcome of risk analysis."""

    score: int
    recommendations: tuple[str, ...]


class RiskAnalyzer:
    """Pure-function style risk analyser. No I/O."""

    def assess(
        self,
        metadata: ProjectMetadata,
        dependencies: list[DependencySummary],
        inventory: FileInventory,
    ) -> RiskAssessment:
        """Produce a composite risk score and recommendations."""
        raise NotImplementedError
