"""Org Structure pillar engine — V1 lightweight (QRE-driven).

Full Org Structure analysis requires Employee Master + Org Chart uploads
(planned for Build 2). For V1 we score 4 themes off QRE responses + PO-derived
proxies (vendor count, plant count).
"""
from .runner import run_org_structure

__all__ = ["run_org_structure"]
