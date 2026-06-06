"""Stage 9 — Canonical Category Classification (multi-tier accumulator).

For each PO row, accumulates signals from up to 6 tiers and assigns a
canonical_id from the industry's categories-master.yml taxonomy.

Tier cascade:
  0 — Archetype pre-classifier (PSTYP + MTART): narrows candidate pool
       to canonicals matching the archetype hint before A-F vote.
  A — HSN/SAC lookup (8/6/4-digit prefix).
  B — Multi-source clean rollup (95% rule), three independent sub-tiers:
       B1 = material_group (MATKL)
       B2 = external_material_group (EXTWG)
       B3 = old_material_number (BISMT) leading-prefix
  C — Weighted text scan across 8 text-bearing columns:
       material_long_text (×1.5), material_master_desc (×1.2),
       material_group_desc (×1.0), external_material_group_desc (×1.0),
       short_text (×1.0), item_note (×0.8),
       material_number (×0.6), old_material_number (×0.5)
  D — Vendor anchor (vendor_specialisation_examples substring).
  E — Buyer-group anchor (learned from data — if ≥85% of buyer X's
       confidently-classified rows map to canonical Y, then unclassified
       rows from buyer X get Y as corroboration only).
  F — LLM fallback — V2.

  (Old Tier E "G/L anchor" was dropped — gl_account is rarely populated
  in real client PO dumps; replaced by buyer-group anchor.)

Output per row: canonical_id, confidence_tier, signal_trace, archetype.

The signal trace records every tier that fired, with weight (primary or
corroboration) and the matched signal value. This is what the Stage 9
review UI surfaces in the per-row drawer.
"""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import Optional

import pandas as pd
import yaml

from .. import config


# --------------------------------------------------------------------------
# Tier weights — primary tiers (A, B*, C) carry full vote;
# corroboration tiers (D, E) require another primary to reach HIGH.
# --------------------------------------------------------------------------

TIER_WEIGHTS = {"B0": 5, "A": 3, "B": 3, "C": 2, "D": 2, "E": 1, "F": 1}

# Text columns scanned for Tier C with per-column weight multipliers.
# Higher weight = stronger contribution to the canonical's score.
TEXT_COLUMNS_WEIGHTED = (
    ("material_long_text",           1.5),  # MAKT — richest description
    ("material_master_desc",         1.2),  # MARA-MAKTX
    ("material_group_desc",          1.0),  # MATKL description (V1 default)
    ("external_material_group_desc", 1.0),  # EXTWG description
    ("short_text",                   1.0),  # TXZ01 line description
    ("item_note",                    0.8),  # TXZ02 free-text note
    ("material_number",              0.6),  # MATNR — code may carry prefix
    ("old_material_number",          0.5),  # BISMT — legacy code prefix
)

# Archetype derived from MTART (SAP Material Type)
MTART_TO_ARCHETYPE = {
    "DIEN": "SERVICE",   # Services
    "ANLZ": "CAPEX",     # Asset
    "ANLG": "CAPEX",     # Asset (alternate)
    "ERSA": "INDIRECT",  # Spare parts
    "ROH":  "DIRECT",    # Raw material
    "HALB": "DIRECT",    # Semi-finished
    "FERT": "DIRECT",    # Finished
    "HIBE": "INDIRECT",  # Operating supplies
    "VERP": "INDIRECT",  # Packaging
    "NLAG": "INDIRECT",  # Non-stock
}

# Archetype derived from PSTYP (SAP Item Category) — overrides MTART when both fire
PSTYP_TO_ARCHETYPE = {
    "A": "CAPEX",        # Asset
    "D": "SERVICE",      # Service
    # K=Consignment, L=Subcontract, B=Limit — leave as no hint
}


# --------------------------------------------------------------------------
# KB loader
# --------------------------------------------------------------------------

_taxonomy_cache: dict[str, dict] = {}


def load_taxonomy(industry: str) -> dict:
    """Load + index the industry's categories-master.yml.
    Returns: {canonicals: [...], by_id: {id → canonical}, indexes: {...}}"""
    key = industry.lower()
    if key in _taxonomy_cache:
        return _taxonomy_cache[key]

    path = config.SHARED_KB_ROOT / "industries" / key / "categories-master.yml"
    if not path.exists():
        _taxonomy_cache[key] = {"canonicals": [], "by_id": {}, "indexes": {}}
        return _taxonomy_cache[key]

    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    canonicals = data.get("canonicals") or []

    by_id: dict[str, dict] = {c["id"]: c for c in canonicals if c.get("id")}

    # Indexes for fast lookup
    hsn_to_canon: dict[str, str] = {}   # exact HSN (4/6/8 digit) → canonical_id
    for c in canonicals:
        for h in (c.get("hsn_codes") or []):
            h_str = str(h).strip()
            if h_str and h_str not in hsn_to_canon:
                hsn_to_canon[h_str] = c["id"]

    # Text-match index: (canonical_id, partition_mtart_set, [(token, kind)])
    # kind: 'keyword' | 'synonym'
    text_index: list[tuple[str, set[str], list[tuple[str, str]]]] = []
    for c in canonicals:
        mtart = set((c.get("sap_signals") or {}).get("mtart") or [])
        tokens: list[tuple[str, str]] = []
        for kw in (c.get("keywords") or []):
            t = str(kw).lower().strip()
            if t: tokens.append((t, "keyword"))
        for sy in (c.get("synonyms") or []):
            t = str(sy).lower().strip()
            if t: tokens.append((t, "synonym"))
        if tokens:
            text_index.append((c["id"], mtart, tokens))

    # Vendor anchor index: (canonical_id, [vendor_substring_lower])
    vendor_index: list[tuple[str, list[str]]] = []
    for c in canonicals:
        subs = [str(v).lower().strip() for v in (c.get("vendor_specialisation_examples") or []) if v]
        if subs:
            vendor_index.append((c["id"], subs))

    # EXTWG (external material group) → canonical map for Tier B2
    # Each canonical can declare `external_mg_codes: [...]` in YAML.
    extwg_to_canon: dict[str, str] = {}
    for c in canonicals:
        for code in (c.get("external_mg_codes") or []):
            k = str(code).strip().upper()
            if k and k not in extwg_to_canon:
                extwg_to_canon[k] = c["id"]

    # BISMT (legacy material number) prefix → canonical map for Tier B3
    # Each canonical can declare `bismt_prefixes: [...]` in YAML.
    bismt_prefix_to_canon: list[tuple[str, str]] = []  # (prefix_upper, canonical_id)
    for c in canonicals:
        for pfx in (c.get("bismt_prefixes") or []):
            p = str(pfx).strip().upper()
            if p:
                bismt_prefix_to_canon.append((p, c["id"]))
    # Sort by prefix length desc so longest-prefix match wins
    bismt_prefix_to_canon.sort(key=lambda t: -len(t[0]))

    # Canonical → archetype map (for Tier 0 candidate narrowing)
    canonical_archetype: dict[str, str] = {}
    for c in canonicals:
        arch = c.get("archetype")
        if arch:
            canonical_archetype[c["id"]] = str(arch).upper()

    _taxonomy_cache[key] = {
        "canonicals": canonicals,
        "by_id": by_id,
        "indexes": {
            "hsn_to_canon": hsn_to_canon,
            "text_index": text_index,
            "vendor_index": vendor_index,
            "extwg_to_canon": extwg_to_canon,
            "bismt_prefix_to_canon": bismt_prefix_to_canon,
            "canonical_archetype": canonical_archetype,
        },
    }
    return _taxonomy_cache[key]


def invalidate_taxonomy_cache():
    _taxonomy_cache.clear()


# --------------------------------------------------------------------------
# Tier resolvers (each returns [(canonical_id, signal_dict)])
# --------------------------------------------------------------------------

def _tier_a_hsn(row: dict, idx: dict) -> list[tuple[str, dict]]:
    """HSN exact match (8 → 6 → 4 digit prefix fallback)."""
    hsn = str(row.get("hsn_code") or "").strip()
    if not hsn:
        return []
    hsn_map = idx["hsn_to_canon"]
    # Try 8, 6, 4-digit prefixes
    for length in (8, 6, 4):
        key = hsn[:length]
        if key in hsn_map:
            return [(hsn_map[key],
                      {"tier": "A", "signal": f"HSN {key} → exact match",
                       "value": key, "weight": "primary"})]
    return []


def _tier_b0_manual_override(row: dict, overrides: dict[str, dict[str, str]]) -> list[tuple[str, dict]]:
    """Tier B0 — engagement-level manual canonical assignment.

    Highest priority — overrides every automated tier. Consultant assigns
    a MATKL/EXTWG/MATNR/BISMT scope to a canonical via the Stage 9 review
    UI or the Op Model unclassified bucket. Stored in
    stage9_canonical_overrides table; retrieved as a dict here.

    overrides format: {scope_type: {scope_value: canonical_id}}
    """
    if not overrides:
        return []
    for scope_type in ("material_group", "external_material_group",
                        "material_number", "old_material_number"):
        scope_map = overrides.get(scope_type)
        if not scope_map:
            continue
        v = str(row.get(scope_type) or "").strip()
        if scope_type in ("external_material_group", "old_material_number"):
            v = v.upper()
        if v and v in scope_map:
            return [(scope_map[v],
                      {"tier": "B0", "subtier": "B0",
                       "signal": f"Manual override on {scope_type} '{v}'",
                       "value": v, "weight": "primary"})]
    return []


def _tier_0_archetype_hint(row: dict) -> Optional[str]:
    """Return archetype hint from PSTYP first (more reliable), then MTART.
    Returns None if neither column has a recognised value."""
    pstyp = str(row.get("item_category") or "").upper().strip()
    if pstyp in PSTYP_TO_ARCHETYPE:
        return PSTYP_TO_ARCHETYPE[pstyp]
    mtart = str(row.get("material_type") or "").upper().strip()
    if mtart in MTART_TO_ARCHETYPE:
        return MTART_TO_ARCHETYPE[mtart]
    return None


def _tier_b1_clean_mg(row: dict, clean_mg_map: dict[str, str]) -> list[tuple[str, dict]]:
    """Tier B1 — Clean MATKL rollup (95% rule). Internal material group."""
    mg = str(row.get("material_group") or "").strip()
    if mg and mg in clean_mg_map:
        return [(clean_mg_map[mg],
                  {"tier": "B", "subtier": "B1", "signal": f"Clean MATKL '{mg}' → inherited",
                   "value": mg, "weight": "primary"})]
    return []


def _tier_b2_clean_extwg(row: dict, clean_extwg_map: dict[str, str], idx: dict) -> list[tuple[str, dict]]:
    """Tier B2 — Clean EXTWG rollup OR direct EXTWG→canonical lookup from KB."""
    extwg = str(row.get("external_material_group") or "").strip().upper()
    if not extwg:
        return []
    # Direct KB-declared EXTWG mapping wins
    direct = idx.get("extwg_to_canon", {}).get(extwg)
    if direct:
        return [(direct,
                  {"tier": "B", "subtier": "B2", "signal": f"EXTWG '{extwg}' → KB-declared",
                   "value": extwg, "weight": "primary"})]
    # Otherwise fall back to clean-EXTWG inheritance (95% rule, built from data)
    if extwg in clean_extwg_map:
        return [(clean_extwg_map[extwg],
                  {"tier": "B", "subtier": "B2", "signal": f"Clean EXTWG '{extwg}' → inherited",
                   "value": extwg, "weight": "primary"})]
    return []


def _tier_b3_bismt_prefix(row: dict, idx: dict) -> list[tuple[str, dict]]:
    """Tier B3 — BISMT (legacy material number) leading-prefix lookup from KB."""
    bismt = str(row.get("old_material_number") or "").strip().upper()
    if not bismt:
        return []
    for prefix, canon_id in idx.get("bismt_prefix_to_canon", []):
        if bismt.startswith(prefix):
            return [(canon_id,
                      {"tier": "B", "subtier": "B3", "signal": f"BISMT '{bismt}' starts with '{prefix}'",
                       "value": prefix, "weight": "primary"})]
    return []


def _tier_c_text(row: dict, idx: dict, mtart_filter: Optional[str],
                  archetype_hint: Optional[str], canonical_archetype: dict) -> list[tuple[str, dict]]:
    """Weighted keyword + synonym match across 8 text columns.

    Each column contributes hits with a per-column weight multiplier; the
    aggregate score reflects both match count AND which column matched.
    A hit in MAKT (long text) counts 3× more than a hit in BISMT.

    Two-pass MTART partition (current Tier C behavior preserved): if Pass 1
    with MTART partition yields no hits, retry without it.
    """
    # Build per-column text payload with weight
    col_texts: list[tuple[str, float, str]] = []
    for col, weight in TEXT_COLUMNS_WEIGHTED:
        v = row.get(col)
        if v:
            col_texts.append((col, weight, str(v).lower()))
    if not col_texts:
        return []

    def _scan(use_partition: bool) -> list[tuple[str, dict]]:
        out: list[tuple[str, dict]] = []
        for canon_id, mtart_set, tokens in idx["text_index"]:
            if use_partition and mtart_filter and mtart_set and mtart_filter not in mtart_set:
                continue
            # Tier 0 archetype narrowing — skip canonicals whose archetype
            # contradicts the hint (still allow when hint is None or canonical
            # has no declared archetype).
            if archetype_hint:
                ca = canonical_archetype.get(canon_id)
                if ca and ca != archetype_hint:
                    continue
            weighted_score = 0.0
            match_count = 0
            matched_tokens: list[str] = []
            matched_cols: set[str] = set()
            for token, kind in tokens:
                pat = r"\b" + re.escape(token) + r"\b"
                for col, weight, text in col_texts:
                    if re.search(pat, text):
                        weighted_score += weight
                        match_count += 1
                        if token not in matched_tokens:
                            matched_tokens.append(token)
                        matched_cols.add(col)
                        break  # one column per token is enough
            if match_count > 0:
                signal_label = f"text match: {', '.join(matched_tokens[:3])}"
                if match_count > 3: signal_label += f" (+{match_count-3} more)"
                if matched_cols: signal_label += f" · cols: {','.join(sorted(matched_cols))}"
                if not use_partition: signal_label += " · MTART partition bypassed"
                out.append((canon_id, {
                    "tier": "C",
                    "signal": signal_label,
                    "value": matched_tokens[:3],
                    "match_count": match_count,
                    "weighted_score": round(weighted_score, 2),
                    "matched_columns": sorted(matched_cols),
                    "weight": "primary",
                    "partition_bypassed": not use_partition,
                }))
        return out

    hits = _scan(use_partition=True)
    if not hits:
        hits = _scan(use_partition=False)
    return hits


def _tier_d_vendor(row: dict, idx: dict) -> list[tuple[str, dict]]:
    """Vendor name substring match against vendor_specialisation_examples."""
    name = str(row.get("vendor_name") or "").lower()
    if not name:
        return []
    hits: list[tuple[str, dict]] = []
    for canon_id, subs in idx["vendor_index"]:
        for sub in subs:
            if sub in name:
                hits.append((canon_id, {
                    "tier": "D",
                    "signal": f"vendor name contains '{sub}'",
                    "value": sub,
                    "weight": "corroboration",
                }))
                break  # one hit per canonical
    return hits


def _tier_e_buyer_group(row: dict, buyer_canon_map: dict[str, str]) -> list[tuple[str, dict]]:
    """Tier E — buyer-group anchor (learned from data).

    buyer_canon_map is built in pass-1.5 by Stage 9 from rows already
    classified with HIGH/MEDIUM confidence: for each EKGRP where ≥85% of
    confidently-classified rows map to canonical Y, EKGRP → Y.

    Corroboration only — never wins alone.
    """
    bg = str(row.get("purchase_group") or "").strip().upper()
    if bg and bg in buyer_canon_map:
        return [(buyer_canon_map[bg],
                  {"tier": "E", "signal": f"Buyer group '{bg}' → learned anchor",
                   "value": bg, "weight": "corroboration"})]
    return []


# --------------------------------------------------------------------------
# Score + confidence
# --------------------------------------------------------------------------

def _aggregate(signals: list[tuple[str, dict]]) -> tuple[Optional[str], str, list[dict], dict]:
    """Aggregate per-tier signals into a single canonical assignment.
    Returns (canonical_id, confidence_tier, signal_trace, candidates_dict)."""
    if not signals:
        return None, "UNCLASSIFIED", [], {}

    # Group by canonical
    by_canon: dict[str, list[dict]] = {}
    for canon_id, sig in signals:
        by_canon.setdefault(canon_id, []).append(sig)

    # Score each canonical:
    #   - sum tier weights (counted once per tier letter)
    #   - Tier B sub-tier bonus: if multiple of {B1,B2,B3} agree, +1 per extra
    #   - Tier C: use weighted_score (column-weighted) instead of flat weight
    scores: dict[str, dict] = {}
    for canon_id, sigs in by_canon.items():
        tiers_fired = {s["tier"] for s in sigs}
        b_subtiers = {s.get("subtier") for s in sigs if s["tier"] == "B" and s.get("subtier")}
        c_signals = [s for s in sigs if s["tier"] == "C"]
        score = 0.0
        for t in tiers_fired:
            if t == "C" and c_signals:
                # Use weighted_score from Tier C (column-weighted aggregate)
                score += max(s.get("weighted_score", 0) for s in c_signals)
            else:
                score += TIER_WEIGHTS.get(t, 0)
        # B sub-tier corroboration bonus
        if len(b_subtiers) >= 2:
            score += (len(b_subtiers) - 1)
        scores[canon_id] = {"score": score, "tiers": sorted(tiers_fired),
                              "b_subtiers": sorted(b_subtiers),
                              "signals": sigs,
                              "c_match_count": max((s.get("match_count", 0) for s in c_signals), default=0)}

    # Pick winner: highest score; tie → highest Tier C match_count → most signals
    winner = max(scores.items(),
                  key=lambda kv: (kv[1]["score"], kv[1]["c_match_count"], len(kv[1]["signals"])))
    canon_id, info = winner

    # Confidence assignment:
    #   HIGH  if Tier A (HSN), OR ≥2 of {B1,B2,B3} agree, OR (Tier C ≥3 hits AND Tier D)
    #   HIGH  if any single Tier B sub-tier fires AND another primary corroborates
    #   MEDIUM if single Tier B alone, OR Tier C alone, OR Tier D alone, OR Tier C + Tier E
    #   LOW   if only Tier E (buyer anchor) corroborates, OR only Tier F (V2)
    tiers = set(info["tiers"])
    b_subs = set(info.get("b_subtiers") or [])
    c_match_count = info.get("c_match_count", 0)

    if "B0" in tiers:
        confidence = "HIGH"
    elif "A" in tiers:
        confidence = "HIGH"
    elif len(b_subs) >= 2:
        confidence = "HIGH"
    elif "C" in tiers and "D" in tiers and c_match_count >= 3:
        confidence = "HIGH"
    elif "B" in tiers and (tiers & {"C", "D"}):
        confidence = "HIGH"
    elif tiers & {"B", "C", "D"}:
        confidence = "MEDIUM"
    elif tiers == {"E"} or tiers == {"F"}:
        confidence = "LOW"
    else:
        confidence = "MEDIUM"

    # Sort signal trace: primary tiers first, then corroboration
    trace = sorted(info["signals"], key=lambda s: (
        0 if s["weight"] == "primary" else 1,
        list("ABCDEF").index(s["tier"]) if s["tier"] in "ABCDEF" else 99,
    ))

    # Candidate alternatives (top 3 other canonicals)
    alts = sorted([(cid, v["score"]) for cid, v in scores.items() if cid != canon_id],
                    key=lambda x: -x[1])[:3]
    candidates = {"winner_score": info["score"], "alternatives": [{"canonical_id": a, "score": s} for a, s in alts]}

    return canon_id, confidence, trace, candidates


# --------------------------------------------------------------------------
# Rollup helpers (Tier B sources + Tier E source)
# --------------------------------------------------------------------------

def _build_clean_rollup(pass1_results: list[dict], records: list[dict],
                          scope_col: str, threshold: float = 0.95
                          ) -> tuple[dict[str, str], dict[str, dict]]:
    """Build a clean rollup map keyed by scope_col (e.g. material_group or
    external_material_group). For each scope value, if ≥threshold of pass-1
    classified rows agree on one canonical, that scope → canonical.
    Returns (clean_map, rollup_stats)."""
    clean_map: dict[str, str] = {}
    rollup_stats: dict[str, dict] = {}
    if scope_col not in records[0] if records else True:
        # If no records or scope_col missing, return empty
        if not records or scope_col not in (records[0].keys() if records else []):
            return clean_map, rollup_stats

    by_scope: dict[str, list[Optional[str]]] = {}
    for p1, r in zip(pass1_results, records):
        scope_val = str(r.get(scope_col) or "").strip()
        if scope_col == "external_material_group":
            scope_val = scope_val.upper()
        if not scope_val:
            continue
        by_scope.setdefault(scope_val, []).append(p1["canonical_id"])

    for scope_val, canons in by_scope.items():
        total = len(canons)
        counts: dict[str, int] = {}
        for c in canons:
            if c:
                counts[c] = counts.get(c, 0) + 1
        if not counts:
            rollup_stats[scope_val] = {"clean": False, "winning": None, "share": 0.0, "total": total}
            continue
        winner = max(counts.items(), key=lambda x: x[1])
        share = winner[1] / total
        if share >= threshold:
            clean_map[scope_val] = winner[0]
            rollup_stats[scope_val] = {"clean": True, "winning": winner[0],
                                          "share": round(share, 3), "total": total}
        else:
            rollup_stats[scope_val] = {"clean": False, "winning": winner[0],
                                          "share": round(share, 3), "total": total}
    return clean_map, rollup_stats


def _build_buyer_anchor(pass1_results: list[dict], records: list[dict],
                          threshold: float = 0.85, min_rows: int = 5
                          ) -> dict[str, str]:
    """Build EKGRP (purchase_group) → canonical map for Tier E corroboration.

    Only uses rows where pass 1 produced HIGH or MEDIUM confidence — LOW and
    UNCLASSIFIED rows don't contribute. Requires ≥min_rows confidently-classified
    rows in the buyer-group before any inference. ≥threshold agreement assigns.
    """
    by_buyer: dict[str, list[str]] = {}
    for p1, r in zip(pass1_results, records):
        if p1["confidence"] not in ("HIGH", "MEDIUM"):
            continue
        bg = str(r.get("purchase_group") or "").strip().upper()
        cid = p1.get("canonical_id")
        if not bg or not cid:
            continue
        by_buyer.setdefault(bg, []).append(cid)

    out: dict[str, str] = {}
    for bg, canons in by_buyer.items():
        if len(canons) < min_rows:
            continue
        counts: dict[str, int] = {}
        for c in canons:
            counts[c] = counts.get(c, 0) + 1
        winner, n = max(counts.items(), key=lambda x: x[1])
        if n / len(canons) >= threshold:
            out[bg] = winner
    return out


# --------------------------------------------------------------------------
# Public entrypoint
# --------------------------------------------------------------------------

def classify_canonical(df: pd.DataFrame, industry: str = "steel",
                          manual_overrides: Optional[dict[str, dict[str, str]]] = None
                          ) -> tuple[pd.DataFrame, dict]:
    """Run the multi-tier classifier on a PO DataFrame. Returns (df, report).

    The df gets these new columns:
        canonical_id          — taxonomy id (or 'UNCLASSIFIED')
        canonical_label       — human label
        archetype             — BULK/DIRECT/INDIRECT/SERVICE/CAPEX/UNKNOWN
        confidence_tier       — HIGH / MEDIUM / LOW / UNCLASSIFIED
        signal_trace_json     — JSON-serialised list of signal dicts
        winner_score          — aggregated tier-weight score for the winner
        alternative_canonicals — JSON-serialised top alternatives

    Args:
        manual_overrides — optional {scope_type: {scope_value: canonical_id}}.
            When provided, rows matching any override are classified at Tier
            B0 with HIGH confidence regardless of other signals.

    Report carries: counts by tier/confidence, clean rollups, unclassified rate.
    """
    overrides = manual_overrides or {}
    tx = load_taxonomy(industry)
    idx = tx.get("indexes") or {}
    by_id = tx.get("by_id") or {}
    if not by_id:
        # No taxonomy available — populate UNCLASSIFIED columns and return
        df = df.copy()
        df["canonical_id"] = "UNCLASSIFIED"
        df["canonical_label"] = "UNCLASSIFIED"
        df["archetype"] = "UNKNOWN"
        df["confidence_tier"] = "UNCLASSIFIED"
        df["signal_trace_json"] = "[]"
        df["winner_score"] = 0
        df["alternative_canonicals"] = "[]"
        return df, {"error": "no_taxonomy", "industry": industry,
                     "stats": {"total_rows": int(len(df)), "unclassified": int(len(df))}}

    import json
    canonical_archetype = idx.get("canonical_archetype") or {}

    records = df.to_dict(orient="records")

    # --- Pass 1: classify every row.
    # B0 (manual override) is checked first and short-circuits if it fires.
    # Otherwise Tier 0 (archetype hint) + A + C + D + B2 (direct) + B3 vote.
    pass1_results: list[dict] = []
    for r in records:
        archetype_hint = _tier_0_archetype_hint(r)
        # Manual override short-circuit
        b0_hit = _tier_b0_manual_override(r, overrides)
        if b0_hit:
            canon_id = b0_hit[0][0]
            trace = [b0_hit[0][1]]
            pass1_results.append({
                "canonical_id": canon_id, "confidence": "HIGH",
                "trace": trace,
                "candidates": {"winner_score": TIER_WEIGHTS["B0"], "alternatives": []},
                "material_group": r.get("material_group"),
                "external_material_group": r.get("external_material_group"),
                "archetype_hint": archetype_hint,
            })
            continue

        mtart = str(r.get("material_type") or "").upper().strip() or None
        signals: list[tuple[str, dict]] = []
        signals.extend(_tier_a_hsn(r, idx))
        signals.extend(_tier_c_text(r, idx, mtart_filter=mtart,
                                       archetype_hint=archetype_hint,
                                       canonical_archetype=canonical_archetype))
        signals.extend(_tier_d_vendor(r, idx))
        # Tier B2 direct EXTWG → canonical (KB-declared) can fire in pass 1
        signals.extend(_tier_b2_clean_extwg(r, {}, idx))
        # Tier B3 BISMT prefix can fire in pass 1
        signals.extend(_tier_b3_bismt_prefix(r, idx))
        canon, conf, trace, candidates = _aggregate(signals)
        pass1_results.append({"canonical_id": canon, "confidence": conf,
                                "trace": trace, "candidates": candidates,
                                "material_group": r.get("material_group"),
                                "external_material_group": r.get("external_material_group"),
                                "archetype_hint": archetype_hint})

    # --- Step 3a: MATKL rollup (Tier B1 source — 95% rule) ---
    clean_mg_map, mg_rollup_stats = _build_clean_rollup(
        pass1_results, records, scope_col="material_group")

    # --- Step 3b: EXTWG rollup (Tier B2 source — 95% rule) ---
    clean_extwg_map, extwg_rollup_stats = _build_clean_rollup(
        pass1_results, records, scope_col="external_material_group")

    # --- Step 3c: Buyer-group anchor (Tier E source — 85% rule) ---
    # Build from confidently-classified pass 1 rows only
    buyer_canon_map = _build_buyer_anchor(pass1_results, records,
                                            threshold=0.85, min_rows=5)

    # --- Pass 2: re-classify using Tier B1 (clean-MATKL), Tier B2 (clean-EXTWG),
    # Tier E (buyer anchor). Only re-resolves rows that were UNCLASSIFIED or
    # LOW confidence in pass 1; for rows that already classified MEDIUM+ we
    # still add corroboration signals to strengthen confidence.
    final_results: list[dict] = []
    pass2_upgraded = 0
    for r_in, p1 in zip(records, pass1_results):
        if p1["canonical_id"] is None or p1["confidence"] in ("LOW",):
            # Try to upgrade via Tier B1 + B2 + E
            archetype_hint = p1.get("archetype_hint")
            mtart = str(r_in.get("material_type") or "").upper().strip() or None
            extra_signals: list[tuple[str, dict]] = []
            extra_signals.extend(_tier_b1_clean_mg(r_in, clean_mg_map))
            extra_signals.extend(_tier_b2_clean_extwg(r_in, clean_extwg_map, idx))
            extra_signals.extend(_tier_e_buyer_group(r_in, buyer_canon_map))
            # Re-run Tier C with archetype hint (canonical pool may now match)
            extra_signals.extend(_tier_a_hsn(r_in, idx))
            extra_signals.extend(_tier_c_text(r_in, idx, mtart_filter=mtart,
                                                  archetype_hint=archetype_hint,
                                                  canonical_archetype=canonical_archetype))
            extra_signals.extend(_tier_d_vendor(r_in, idx))
            extra_signals.extend(_tier_b3_bismt_prefix(r_in, idx))
            canon2, conf2, trace2, cand2 = _aggregate(extra_signals)
            if canon2 and (p1["canonical_id"] is None or conf2 in ("HIGH", "MEDIUM")):
                final_results.append({"canonical_id": canon2, "confidence": conf2,
                                        "trace": trace2, "candidates": cand2,
                                        "archetype_hint": archetype_hint})
                pass2_upgraded += 1
                continue
        final_results.append(p1)

    # --- Write back to DataFrame ---
    df = df.copy()
    df["canonical_id"] = [r["canonical_id"] or "UNCLASSIFIED" for r in final_results]
    df["canonical_label"] = [
        by_id[r["canonical_id"]]["label"] if r["canonical_id"] and r["canonical_id"] in by_id
        else "UNCLASSIFIED"
        for r in final_results
    ]
    # Archetype: prefer Tier 0 hint when canonical archetype agrees or canonical is UNCLASSIFIED;
    # otherwise use canonical's declared archetype. Hint takes precedence for UNCLASSIFIED rows so
    # downstream can still bucket service / capex lines correctly even without a canonical assignment.
    archetypes: list[str] = []
    for r in final_results:
        canon_arch = canonical_archetype.get(r["canonical_id"]) if r["canonical_id"] else None
        hint = r.get("archetype_hint")
        if canon_arch:
            archetypes.append(canon_arch)
        elif hint:
            archetypes.append(hint)
        else:
            archetypes.append("UNKNOWN")
    df["archetype"] = archetypes
    df["confidence_tier"] = [r["confidence"] for r in final_results]
    df["signal_trace_json"] = [json.dumps(r["trace"]) for r in final_results]
    df["winner_score"] = [r["candidates"].get("winner_score", 0) for r in final_results]
    df["alternative_canonicals"] = [json.dumps(r["candidates"].get("alternatives", []))
                                      for r in final_results]

    # --- Report ---
    confidence_counts: dict[str, int] = {}
    for r in final_results:
        confidence_counts[r["confidence"]] = confidence_counts.get(r["confidence"], 0) + 1
    tier_fired_counts: dict[str, int] = {"B0": 0, "A": 0, "B": 0, "C": 0, "D": 0, "E": 0, "F": 0}
    b_subtier_fired: dict[str, int] = {"B0": 0, "B1": 0, "B2": 0, "B3": 0}
    for r in final_results:
        for s in r["trace"]:
            tier_fired_counts[s["tier"]] = tier_fired_counts.get(s["tier"], 0) + 1
            sub = s.get("subtier")
            if sub in b_subtier_fired:
                b_subtier_fired[sub] += 1
    canonical_counts: dict[str, int] = {}
    for r in final_results:
        cid = r["canonical_id"] or "UNCLASSIFIED"
        canonical_counts[cid] = canonical_counts.get(cid, 0) + 1

    # Sample rows by confidence tier (cap counts; frontend pages through them)
    SAMPLE_CAP = 200
    samples_by_conf: dict[str, list[dict]] = {"HIGH": [], "MEDIUM": [], "LOW": [], "UNCLASSIFIED": []}
    for r_in, fr in zip(df.to_dict(orient="records"), final_results):
        conf = fr["confidence"]
        if len(samples_by_conf.get(conf, [])) >= SAMPLE_CAP:
            continue
        samples_by_conf.setdefault(conf, []).append({
            "po_number": str(r_in.get("po_number") or ""),
            "po_item": str(r_in.get("po_item") or ""),
            "material_group": str(r_in.get("material_group") or ""),
            "material_group_desc": str(r_in.get("material_group_desc") or "")[:120],
            "short_text": str(r_in.get("short_text") or "")[:120],
            "material_type": str(r_in.get("material_type") or ""),
            "vendor_name": str(r_in.get("vendor_name") or "")[:60],
            "net_value": float(r_in.get("net_value") or 0),
            "canonical_id": fr["canonical_id"] or "UNCLASSIFIED",
            "canonical_label": (by_id.get(fr["canonical_id"]) or {}).get("label") or "UNCLASSIFIED",
            "confidence": fr["confidence"],
            "signal_trace": fr["trace"],
            "winner_score": fr["candidates"].get("winner_score", 0),
            "alternatives": fr["candidates"].get("alternatives", [])[:3],
        })

    # Clean-MG roster (sorted by total rows desc)
    clean_mg_list = sorted(
        [{"material_group": mg, "canonical_id": v["winning"],
            "canonical_label": (by_id.get(v["winning"]) or {}).get("label") or "UNCLASSIFIED",
            "share_pct": round(v["share"] * 100, 1), "row_count": v["total"]}
         for mg, v in mg_rollup_stats.items() if v["clean"]],
        key=lambda x: -x["row_count"],
    )
    mixed_mg_list = sorted(
        [{"material_group": mg, "leading_canonical_id": v["winning"],
            "leading_canonical_label": (by_id.get(v["winning"]) or {}).get("label") or "UNCLASSIFIED",
            "leading_share_pct": round(v["share"] * 100, 1), "row_count": v["total"]}
         for mg, v in mg_rollup_stats.items() if not v["clean"]],
        key=lambda x: -x["row_count"],
    )

    # Taxonomy summary for UI (id + label + archetype)
    taxonomy_list = [{"id": c["id"], "label": c.get("label", c["id"]),
                       "archetype": c.get("archetype"),
                       "direct_indirect": c.get("direct_indirect")}
                      for c in tx.get("canonicals", [])]

    report = {
        "industry": industry,
        "taxonomy_canonicals": len(by_id),
        "taxonomy": taxonomy_list,
        "stats": {
            "total_rows": int(len(df)),
            "confidence_distribution": confidence_counts,
            "tier_fired_counts": tier_fired_counts,
            "b_subtier_fired": b_subtier_fired,
            "canonicals_assigned": int(sum(1 for r in final_results if r["canonical_id"] and r["canonical_id"] != "UNCLASSIFIED")),
            "unclassified": int(confidence_counts.get("UNCLASSIFIED", 0)),
            "unclassified_pct": round(confidence_counts.get("UNCLASSIFIED", 0) / max(len(df), 1) * 100, 2),
            "pass2_upgraded": pass2_upgraded,
            "clean_mgs": sum(1 for v in mg_rollup_stats.values() if v["clean"]),
            "mixed_mgs": sum(1 for v in mg_rollup_stats.values() if not v["clean"]),
            "clean_extwgs": sum(1 for v in extwg_rollup_stats.values() if v["clean"]),
            "mixed_extwgs": sum(1 for v in extwg_rollup_stats.values() if not v["clean"]),
            "buyer_anchors_learned": len(buyer_canon_map),
        },
        "clean_mg_map": clean_mg_map,
        "clean_mg_roster": clean_mg_list,
        "mixed_mg_roster": mixed_mg_list,
        "clean_extwg_map": clean_extwg_map,
        "buyer_anchor_map": buyer_canon_map,
        "canonical_distribution": canonical_counts,
        "samples_by_confidence": samples_by_conf,
        "sample_cap": SAMPLE_CAP,
    }
    return df, report
