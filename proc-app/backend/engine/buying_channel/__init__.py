"""Buying Channel pillar engine.

Single theme (buying-channel-strategy) with 13 components.
Reads:
  - per-MG metrics from Stage 10 (po_count, distinct_months, avg_po_value, vendor_count, top_vendor_share_pct, contracted_pct, pac_pct)
  - archetype from Stage 9 (per categories-master.yml + steel overlay)
  - benchmarks via cascade (Steel overlay applied)
  - 13 IF-THEN recommendation rules from analysis-config.yml
"""
from .runner import run_buying_channel

__all__ = ["run_buying_channel"]
