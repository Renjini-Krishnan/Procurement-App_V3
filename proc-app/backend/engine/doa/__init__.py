"""DoA pillar engine — 5 themes.

Stage 14 (DoA) runs after Stage 8 (Gold), Stage 9 (Classify), Stage 10 (KPIs).
For V1 the DoA document itself isn't parsed — instead we use QRE responses
+ PO data to score each theme.
"""
from .runner import run_doa

__all__ = ["run_doa"]
