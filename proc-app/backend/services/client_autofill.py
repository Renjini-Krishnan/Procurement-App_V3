"""Client profile auto-fill — LLM with deterministic fallback.

Given a client_name, asks Gemini to suggest:
  - industry (steel | cement)
  - sub_segment
  - plants list (best-effort, may be empty)
  - annual_spend_inr_cr (estimate)
  - annual_revenue_inr_cr (estimate)
  - fte_count (estimate)
  - company_overview (2-3 sentences)
  - financials (revenue / profit / EBITDA + FY + citation)

LLM disabled (no ADC) -> returns a minimal deterministic fallback that
still allows the consultant to proceed manually.

The fallback DOES include the deterministic procurement-category list
from KB, which works regardless of LLM availability.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

import yaml

from .. import config
from . import llm

log = logging.getLogger("procvault.client_autofill")

VALID_INDUSTRIES = {"steel", "cement"}
SUB_SEGMENTS = {
    "steel": [
        "integrated_steel_mill_multi_plant",
        "integrated_steel_mill_single_plant",
        "long_products_mini_mill",
        "specialty_steel",
    ],
    "cement": [
        "integrated_cement_plant",
        "grinding_unit",
    ],
}


def _autofill_prompt(client_name: str) -> str:
    return f"""You are filling in a procurement-assessment app's engagement profile for a
client named: "{client_name}"

Return STRICT JSON with this exact shape and no other text or markdown:

{{
  "industry": "steel" | "cement",
  "sub_segment": one of {SUB_SEGMENTS["steel"] + SUB_SEGMENTS["cement"]},
  "plants": ["<plant name 1>", ...],  // up to 8, best effort, may be []
  "annual_spend_inr_cr": <number, INR Crore, procurement spend, estimate>,
  "annual_revenue_inr_cr": <number, INR Crore, latest annual revenue, estimate>,
  "fte_count": <number, total procurement function FTEs, estimate>,
  "company_overview": "<2-3 sentence neutral overview of who the company is, what they make, where they operate>",
  "financials": {{
    "fy_label": "<e.g. FY24, FY25, Q3 FY24>",
    "revenue_inr_cr": <number>,
    "profit_after_tax_inr_cr": <number>,
    "ebitda_inr_cr": <number>,
    "citation_label": "<e.g. Annual Report 2024, Q3 FY25 results>",
    "citation_url": "<public URL to the source document>"
  }},
  "overall_confidence": "high" | "medium" | "low"
}}

Rules:
- If you cannot identify the company with confidence, set overall_confidence to "low"
  and return your best estimate (do not return null).
- Only steel or cement industries are supported. If the company is neither,
  still pick the closer one and set overall_confidence to "low".
- citation_url must be a public URL (annual report PDF or investor page).
  If not available, set citation_url to "".
- Plants list is best-effort: list known manufacturing locations.
- Output JSON only — no prose, no code fences.
"""


def autofill(client_name: str) -> dict:
    """Return engagement-profile suggestions for the given client name."""
    if not client_name or not client_name.strip():
        return _empty_fallback()

    fallback = _heuristic_fallback(client_name)
    if not llm.is_enabled():
        log.info("LLM disabled — returning heuristic fallback for '%s'", client_name)
        return {**fallback, "llm_used": False, "reason": "LLM not configured (gcloud auth required)"}

    prompt = _autofill_prompt(client_name)
    result = llm.generate_json(prompt, fallback)
    return _sanitise(result, fallback)


# --------------------------------------------------------------------------
# Fallback paths
# --------------------------------------------------------------------------

def _heuristic_fallback(client_name: str) -> dict:
    """Best-effort guess from client_name alone (no LLM)."""
    name_l = client_name.lower()
    industry = "steel"   # default
    if "cement" in name_l: industry = "cement"
    elif "steel" in name_l or "iron" in name_l: industry = "steel"
    return {
        "industry": industry,
        "sub_segment": SUB_SEGMENTS[industry][0],
        "plants": [],
        "annual_spend_inr_cr": None,
        "annual_revenue_inr_cr": None,
        "fte_count": None,
        "company_overview": (f"Profile for {client_name} could not be auto-populated. "
                              "The AI service is currently unavailable — please fill in the form manually. "
                              "If you're a developer and want to enable AI auto-fill, see the README "
                              "for Google Cloud ADC setup instructions."),
        "financials": {
            "fy_label": "",
            "revenue_inr_cr": None,
            "profit_after_tax_inr_cr": None,
            "ebitda_inr_cr": None,
            "citation_label": "",
            "citation_url": "",
        },
        "overall_confidence": "low",
        "llm_used": False,
    }


def _empty_fallback() -> dict:
    return {
        "industry": "steel",
        "sub_segment": SUB_SEGMENTS["steel"][0],
        "plants": [],
        "annual_spend_inr_cr": None,
        "annual_revenue_inr_cr": None,
        "fte_count": None,
        "company_overview": "Enter a client name and click Auto-fill.",
        "financials": {"fy_label": "", "revenue_inr_cr": None, "profit_after_tax_inr_cr": None,
                        "ebitda_inr_cr": None, "citation_label": "", "citation_url": ""},
        "overall_confidence": "low",
        "llm_used": False,
    }


# --------------------------------------------------------------------------
# Sanitisation — never trust raw LLM output
# --------------------------------------------------------------------------

_NUM = re.compile(r"[^\d.\-]")


def _coerce_num(v):
    if v is None or v == "": return None
    if isinstance(v, (int, float)): return float(v)
    try:
        return float(_NUM.sub("", str(v))) if any(c.isdigit() for c in str(v)) else None
    except (ValueError, TypeError):
        return None


def _sanitise(raw: dict, fallback: dict) -> dict:
    if not isinstance(raw, dict):
        return {**fallback, "llm_used": True, "warning": "LLM returned non-dict; using fallback"}
    out = {}
    out["industry"] = raw.get("industry") if raw.get("industry") in VALID_INDUSTRIES else fallback["industry"]
    sub = raw.get("sub_segment")
    out["sub_segment"] = sub if sub in SUB_SEGMENTS[out["industry"]] else SUB_SEGMENTS[out["industry"]][0]
    plants = raw.get("plants")
    out["plants"] = plants if isinstance(plants, list) and all(isinstance(p, str) for p in plants) else []
    out["annual_spend_inr_cr"] = _coerce_num(raw.get("annual_spend_inr_cr"))
    out["annual_revenue_inr_cr"] = _coerce_num(raw.get("annual_revenue_inr_cr"))
    out["fte_count"] = int(_coerce_num(raw.get("fte_count"))) if _coerce_num(raw.get("fte_count")) else None
    overview = raw.get("company_overview")
    out["company_overview"] = str(overview)[:1200] if overview else fallback["company_overview"]

    fin = raw.get("financials") or {}
    out["financials"] = {
        "fy_label": str(fin.get("fy_label") or "")[:30],
        "revenue_inr_cr": _coerce_num(fin.get("revenue_inr_cr")),
        "profit_after_tax_inr_cr": _coerce_num(fin.get("profit_after_tax_inr_cr")),
        "ebitda_inr_cr": _coerce_num(fin.get("ebitda_inr_cr")),
        "citation_label": str(fin.get("citation_label") or "")[:120],
        "citation_url": str(fin.get("citation_url") or "")[:500],
    }
    conf = raw.get("overall_confidence")
    out["overall_confidence"] = conf if conf in ("high", "medium", "low") else "low"
    out["llm_used"] = True
    return out


# --------------------------------------------------------------------------
# Procurement categories — KB-driven, always available
# --------------------------------------------------------------------------

def load_categories(industry: str) -> dict:
    """Return typical procurement categories for the industry from KB."""
    industry = industry.lower()
    p = config.INDUSTRIES_DIR / industry / "typical-procurement-categories.yml"
    if not p.exists():
        return {"industry": industry, "categories": [], "source": None,
                 "error": f"No procurement-categories KB file for industry={industry}"}
    try:
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except Exception as e:
        return {"industry": industry, "categories": [], "source": None,
                 "error": f"YAML parse error: {e}"}
    return {
        "industry": industry,
        "categories": data.get("categories", []),
        "tail_spend_principle": data.get("tail_spend_principle", ""),
        "centralisation_candidates": data.get("typical_centralisation_candidates", []),
        "pac_categories": data.get("typical_pac_concentration_categories", []),
        "source": data.get("metadata", {}).get("source"),
        "source_year": data.get("metadata", {}).get("source_year"),
        "confidence": data.get("metadata", {}).get("confidence"),
    }
