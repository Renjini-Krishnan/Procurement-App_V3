"""Op Model — Stage 12 engine.

Runs 4 themes:
  centralisation (6 components: C0-C5)
  shared_services (6 components: SS0-SS5)
  coe (6 components: CE0-CE5)
  tail_spend (6 components: TS0-TS5)

Each theme reads per-MG metrics from Stage 10 + benchmarks from KB
(with industry cascade applied) + industry filter overlays. Outputs
findings per component + a theme maturity score.
"""
from .centralisation import run_centralisation
from .shared_services import run_shared_services
from .coe import run_coe
from .tail_spend import run_tail_spend

__all__ = ["run_centralisation", "run_shared_services", "run_coe", "run_tail_spend"]
