"""Client profile auto-fill — LLM with deterministic fallback.

Given a client_name, asks Gemini for:
  - industry (steel | cement)
  - sub_segment
  - plants list (publicly disclosed manufacturing locations)
  - company_overview (2-3 sentences)
  - financials (revenue / profit / EBITDA + FY) — publicly disclosed only

For every field above, the LLM is required to cite a public source
(annual report page, investor presentation URL, etc.) — if it cannot cite
a source, it returns null for that field. No fabrication.

DELIBERATELY NOT FILLED by the LLM:
  - annual procurement spend (internal — not in annual reports)
  - procurement function FTE count (internal — org-chart data)
These two fields stay blank on the form with a placeholder asking the
consultant to enter the client-confirmed value.

LLM disabled (no ADC) -> returns a minimal deterministic fallback that
still allows the consultant to proceed manually.
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
  "plants": ["<plant name 1>", ...] OR null,
  "company_overview": "<2-3 sentence neutral overview>" OR null,
  "financials": {{
    "fy_label": "<e.g. FY24, FY25, Q3 FY24>",
    "revenue_inr_cr": <number> OR null,
    "profit_after_tax_inr_cr": <number> OR null,
    "ebitda_inr_cr": <number> OR null
  }},
  "sources": {{
    "plants": {{"label": "<doc title>", "url": "<public URL>", "page": "<page or section>"}} OR null,
    "company_overview": {{"label": ..., "url": ..., "page": ...}} OR null,
    "financials.revenue_inr_cr": {{"label": ..., "url": ..., "page": ...}} OR null,
    "financials.profit_after_tax_inr_cr": {{"label": ..., "url": ..., "page": ...}} OR null,
    "financials.ebitda_inr_cr": {{"label": ..., "url": ..., "page": ...}} OR null
  }},
  "overall_confidence": "high" | "medium" | "low"
}}

CRITICAL RULES:
- For EVERY field above, you must EITHER provide a verifiable public source
  in the matching `sources.<field>` entry, OR return null for that field.
  Sources must be specific (Annual Report FY24 page 12; Investor Presentation
  Q2 FY25 slide 8; company website /about page). Generic URLs to the homepage
  do not count.
- If you cannot identify the company, return null for every field that
  needs a source. Do not estimate. Do not fabricate URLs.
- Industry is required (default "steel" if unknown). Sub_segment is required.
  Both are categorical defaults and don't need a source citation.
- DO NOT estimate procurement spend or procurement function FTE count.
  These are internal numbers that are not in any public document. They are
  collected from the consultant separately.
- Plants list must come from a public source (annual report, investor
  presentation, company website). If you cannot cite a source, return null.
- citation URLs must be real public URLs (annual report PDF, investor page,
  press release). If you don't know the URL, leave it as empty string but
  still provide a label.
- Only steel or cement industries are supported. If the company is
  neither, still pick the closer one and set overall_confidence to "low".
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
    """Best-effort categorical guess from client_name alone (no LLM).
    Everything else is left null so the UI can render 'consultant input
    required' for missing fields rather than fabricate."""
    name_l = (client_name or "").lower()
    industry = "steel"
    if "cement" in name_l: industry = "cement"
    elif "steel" in name_l or "iron" in name_l: industry = "steel"
    return {
        "industry": industry,
        "sub_segment": SUB_SEGMENTS[industry][0],
        "plants": None,
        "company_overview": None,
        "financials": {
            "fy_label": "",
            "revenue_inr_cr": None,
            "profit_after_tax_inr_cr": None,
            "ebitda_inr_cr": None,
        },
        "sources": {},   # nothing was filled, so nothing is cited
        "overall_confidence": "low",
        "llm_used": False,
    }


def _empty_fallback() -> dict:
    return {
        "industry": "steel",
        "sub_segment": SUB_SEGMENTS["steel"][0],
        "plants": None,
        "company_overview": None,
        "financials": {"fy_label": "", "revenue_inr_cr": None,
                        "profit_after_tax_inr_cr": None, "ebitda_inr_cr": None},
        "sources": {},
        "overall_confidence": "low",
        "llm_used": False,
    }


# --------------------------------------------------------------------------
# Sanitisation — drops un-cited values + coerces shapes
# --------------------------------------------------------------------------

_NUM = re.compile(r"[^\d.\-]")


def _coerce_num(v):
    if v is None or v == "": return None
    if isinstance(v, (int, float)): return float(v)
    try:
        return float(_NUM.sub("", str(v))) if any(c.isdigit() for c in str(v)) else None
    except (ValueError, TypeError):
        return None


def _clean_source(s) -> Optional[dict]:
    """Return a {label, url, page} dict if the source has at least a label,
    otherwise None. URL is kept only if it looks like one."""
    if not isinstance(s, dict):
        return None
    label = str(s.get("label") or "").strip()[:200]
    url = str(s.get("url") or "").strip()[:500]
    page = str(s.get("page") or "").strip()[:80]
    if not label and not url:
        return None
    # Basic URL sanity — must start with http if non-empty
    if url and not url.startswith(("http://", "https://")):
        url = ""
    if not label:
        return None
    return {"label": label, "url": url, "page": page}


def _sanitise(raw: dict, fallback: dict) -> dict:
    if not isinstance(raw, dict):
        return {**fallback, "llm_used": True, "warning": "LLM returned non-dict; using fallback"}

    out = {}
    out["industry"] = raw.get("industry") if raw.get("industry") in VALID_INDUSTRIES else fallback["industry"]
    sub = raw.get("sub_segment")
    out["sub_segment"] = sub if sub in SUB_SEGMENTS[out["industry"]] else SUB_SEGMENTS[out["industry"]][0]

    raw_sources = raw.get("sources") if isinstance(raw.get("sources"), dict) else {}
    out_sources: dict = {}

    # plants — keep only if a source is provided
    plants = raw.get("plants")
    plants_src = _clean_source(raw_sources.get("plants"))
    if isinstance(plants, list) and all(isinstance(p, str) for p in plants) and plants_src:
        out["plants"] = [p.strip() for p in plants if p.strip()][:12]
        out_sources["plants"] = plants_src
    else:
        out["plants"] = None

    # company_overview — keep only if source provided
    overview = raw.get("company_overview")
    overview_src = _clean_source(raw_sources.get("company_overview"))
    if overview and overview_src:
        out["company_overview"] = str(overview)[:1200]
        out_sources["company_overview"] = overview_src
    else:
        out["company_overview"] = None

    # financials — each number must have its own source
    fin_raw = raw.get("financials") if isinstance(raw.get("financials"), dict) else {}
    fin_out = {"fy_label": str(fin_raw.get("fy_label") or "")[:30]}
    for key in ("revenue_inr_cr", "profit_after_tax_inr_cr", "ebitda_inr_cr"):
        val = _coerce_num(fin_raw.get(key))
        src = _clean_source(raw_sources.get(f"financials.{key}"))
        if val is not None and src:
            fin_out[key] = val
            out_sources[f"financials.{key}"] = src
        else:
            fin_out[key] = None
    out["financials"] = fin_out
    out["sources"] = out_sources

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
