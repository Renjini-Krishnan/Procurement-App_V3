"""Stage 9 — Canonical Category Classification (6-tier accumulator).

Implements the Stage 9 framework spec from KB:
    proc-app/kb/functions/procurement/data-cleansing/categories-master-schema.md

For each PO row, accumulates signals from up to 6 tiers and assigns a
canonical_id from the industry's categories-master.yml taxonomy.

V1 core tiers wired:
  A — HSN/SAC lookup
  B — Clean-MG lookup (intra-run only; cross-run requires engagement
       learned maps which are V2)
  C — Text match (keywords + synonyms against PO text columns)
  D — Vendor anchor (vendor_specialisation_examples)
  F — LLM fallback — V2

  (Tier E "G/L anchor" was dropped — gl_account is rarely populated in
  real client PO dumps, so the tier added noise without coverage.)

Output per row: canonical_id, confidence_tier, signal_trace (list).

The signal trace records every tier that fired, with weight (primary or
corroboration) and the matched signal value. This is what the Stage 9
review UI surfaces in the per-row drawer.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import pandas as pd
import yaml

from .. import config


# --------------------------------------------------------------------------
# Tier weights (per framework section 5 confidence-on-conflict spec)
# --------------------------------------------------------------------------

TIER_WEIGHTS = {"A": 3, "B": 3, "C": 2, "D": 2, "F": 1}

# Text columns scanned for Tier C, in priority order
TEXT_COLUMNS = ("material_group_desc", "short_text")  # MAKT (long text) not in V1 PO schema


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

    _taxonomy_cache[key] = {
        "canonicals": canonicals,
        "by_id": by_id,
        "indexes": {
            "hsn_to_canon": hsn_to_canon,
            "text_index": text_index,
            "vendor_index": vendor_index,
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


def _tier_b_clean_mg(row: dict, clean_mg_map: dict[str, str]) -> list[tuple[str, dict]]:
    """Clean-MG inherited lookup. clean_mg_map is built once per dataframe
    by Step 3 (MG rollup) but only after first pass; for V1 we do a 2-pass
    classification where Tier B only fires on pass 2."""
    mg = str(row.get("material_group") or "").strip()
    if mg and mg in clean_mg_map:
        return [(clean_mg_map[mg],
                  {"tier": "B", "signal": f"Clean-MG '{mg}' → inherited",
                   "value": mg, "weight": "primary"})]
    return []


def _tier_c_text(row: dict, idx: dict, mtart_filter: Optional[str]) -> list[tuple[str, dict]]:
    """Word-boundary keyword + synonym match against PO text columns.

    Two-pass approach (per framework principle: MTART is a fast pre-filter,
    not a hard gate — real client data often has mis-MTARTed rows):
      Pass 1 — apply MTART partition.
      Pass 2 — if Pass 1 yielded nothing, retry without the partition.
    Word boundaries prevent ambiguous matches (e.g. synonym 'GE' inside
    'CARTRIDGE').
    """
    text_parts = []
    for col in TEXT_COLUMNS:
        v = row.get(col)
        if v: text_parts.append(str(v).lower())
    text = " ".join(text_parts)
    if not text.strip():
        return []

    def _scan(use_partition: bool) -> list[tuple[str, dict]]:
        out: list[tuple[str, dict]] = []
        for canon_id, mtart_set, tokens in idx["text_index"]:
            if use_partition and mtart_filter and mtart_set and mtart_filter not in mtart_set:
                continue
            match_count = 0
            matched_tokens: list[str] = []
            for token, kind in tokens:
                pat = r"\b" + re.escape(token) + r"\b"
                if re.search(pat, text):
                    match_count += 1
                    matched_tokens.append(token)
            if match_count > 0:
                tier_signal = "C" if use_partition else "C*"
                signal_label = f"text match: {', '.join(matched_tokens[:3])}"
                if match_count > 3: signal_label += f" (+{match_count-3} more)"
                if not use_partition: signal_label += " · MTART partition bypassed"
                out.append((canon_id, {
                    "tier": "C",
                    "signal": signal_label,
                    "value": matched_tokens[:3],
                    "match_count": match_count,
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

    # Score each canonical: sum tier weights (primary=full, corroboration=full but counted once per tier).
    # Bonus: Tier C scaled by match_count (multi-keyword matches beat single keyword).
    scores: dict[str, dict] = {}
    for canon_id, sigs in by_canon.items():
        tiers_fired = {s["tier"] for s in sigs}
        score = sum(TIER_WEIGHTS.get(t, 0) for t in tiers_fired)
        # Tier C match-count bonus: +0.5 per extra keyword match beyond the first
        c_signals = [s for s in sigs if s["tier"] == "C"]
        if c_signals:
            extra = max(0, max(s.get("match_count", 1) for s in c_signals) - 1)
            score += 0.5 * extra
        scores[canon_id] = {"score": score, "tiers": sorted(tiers_fired),
                              "signals": sigs,
                              "c_match_count": max((s.get("match_count", 0) for s in c_signals), default=0)}

    # Pick winner: highest score; tie → highest Tier C match_count → most signals
    winner = max(scores.items(),
                  key=lambda kv: (kv[1]["score"], kv[1]["c_match_count"], len(kv[1]["signals"])))
    canon_id, info = winner

    # Confidence assignment per framework:
    #   HIGH if Tier A (HSN), Tier B (clean-MG inherit), or (Tier C + Tier D)
    #   MEDIUM if Tier C alone or Tier D alone
    #   LOW if only Tier F (LLM fallback, V2)
    tiers = set(info["tiers"])
    if "A" in tiers or "B" in tiers:
        confidence = "HIGH"
    elif "C" in tiers and "D" in tiers:
        confidence = "HIGH"
    elif tiers & {"C", "D"}:
        confidence = "MEDIUM"
    elif tiers == {"F"}:
        confidence = "LOW"
    else:
        confidence = "MEDIUM"

    # Sort signal trace: primary tiers first, then corroboration
    trace = sorted(info["signals"], key=lambda s: (
        0 if s["weight"] == "primary" else 1,
        list("ABCDF").index(s["tier"]) if s["tier"] in "ABCDF" else 99,
    ))

    # Candidate alternatives (top 3 other canonicals)
    alts = sorted([(cid, v["score"]) for cid, v in scores.items() if cid != canon_id],
                    key=lambda x: -x[1])[:3]
    candidates = {"winner_score": info["score"], "alternatives": [{"canonical_id": a, "score": s} for a, s in alts]}

    return canon_id, confidence, trace, candidates


# --------------------------------------------------------------------------
# Public entrypoint
# --------------------------------------------------------------------------

def classify_canonical(df: pd.DataFrame, industry: str = "steel") -> tuple[pd.DataFrame, dict]:
    """Run the 6-tier classifier on a PO DataFrame. Returns (df, report).

    The df gets these new columns:
        canonical_id          — taxonomy id (or 'UNCLASSIFIED')
        canonical_label       — human label
        confidence_tier       — HIGH / MEDIUM / LOW / UNCLASSIFIED
        signal_trace_json     — JSON-serialised list of signal dicts
        winner_score          — aggregated tier-weight score for the winner
        alternative_canonicals — JSON-serialised top alternatives

    Report carries: counts by tier/confidence, clean-MG rollup, unclassified rate.
    """
    tx = load_taxonomy(industry)
    idx = tx.get("indexes") or {}
    by_id = tx.get("by_id") or {}
    if not by_id:
        # No taxonomy available — populate UNCLASSIFIED columns and return
        df = df.copy()
        df["canonical_id"] = "UNCLASSIFIED"
        df["canonical_label"] = "UNCLASSIFIED"
        df["confidence_tier"] = "UNCLASSIFIED"
        df["signal_trace_json"] = "[]"
        df["winner_score"] = 0
        df["alternative_canonicals"] = "[]"
        return df, {"error": "no_taxonomy", "industry": industry,
                     "stats": {"total_rows": int(len(df)), "unclassified": int(len(df))}}

    import json

    # --- Pass 1: classify every row with Tiers A, C, D ---
    pass1_results: list[dict] = []
    for r in df.to_dict(orient="records"):
        mtart = str(r.get("material_type") or "").upper().strip() or None
        signals: list[tuple[str, dict]] = []
        signals.extend(_tier_a_hsn(r, idx))
        signals.extend(_tier_c_text(r, idx, mtart_filter=mtart))
        signals.extend(_tier_d_vendor(r, idx))
        canon, conf, trace, candidates = _aggregate(signals)
        pass1_results.append({"canonical_id": canon, "confidence": conf,
                                "trace": trace, "candidates": candidates,
                                "material_group": r.get("material_group")})

    # --- Step 3: MG rollup with 95% threshold ---
    clean_mg_map: dict[str, str] = {}
    mg_rollup_stats: dict[str, dict] = {}
    if "material_group" in df.columns:
        # Bucket pass1 results by MG
        by_mg: dict[str, list[Optional[str]]] = {}
        for r in pass1_results:
            mg = str(r["material_group"] or "").strip()
            if not mg: continue
            by_mg.setdefault(mg, []).append(r["canonical_id"])
        for mg, canons in by_mg.items():
            total = len(canons)
            counts: dict[str, int] = {}
            for c in canons:
                if c: counts[c] = counts.get(c, 0) + 1
            if not counts:
                mg_rollup_stats[mg] = {"clean": False, "winning": None, "share": 0.0, "total": total}
                continue
            winner = max(counts.items(), key=lambda x: x[1])
            share = winner[1] / total
            if share >= 0.95:
                clean_mg_map[mg] = winner[0]
                mg_rollup_stats[mg] = {"clean": True, "winning": winner[0],
                                         "share": round(share, 3), "total": total}
            else:
                mg_rollup_stats[mg] = {"clean": False, "winning": winner[0],
                                         "share": round(share, 3), "total": total}

    # --- Pass 2: re-classify UNCLASSIFIED rows using Tier B (clean-MG inherit) ---
    # Only re-resolves rows whose MG is now in the clean map AND that were
    # unclassified OR LOW confidence in pass 1.
    final_results: list[dict] = []
    pass2_upgraded = 0
    for r_in, p1 in zip(df.to_dict(orient="records"), pass1_results):
        # Try Tier B if available
        if clean_mg_map and (p1["canonical_id"] is None or p1["confidence"] in ("LOW",)):
            tb = _tier_b_clean_mg(r_in, clean_mg_map)
            if tb:
                final_results.append({"canonical_id": tb[0][0], "confidence": "HIGH",
                                        "trace": [tb[0][1]],
                                        "candidates": {"winner_score": TIER_WEIGHTS["B"],
                                                        "alternatives": []}})
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
    df["confidence_tier"] = [r["confidence"] for r in final_results]
    df["signal_trace_json"] = [json.dumps(r["trace"]) for r in final_results]
    df["winner_score"] = [r["candidates"].get("winner_score", 0) for r in final_results]
    df["alternative_canonicals"] = [json.dumps(r["candidates"].get("alternatives", []))
                                      for r in final_results]

    # --- Report ---
    confidence_counts: dict[str, int] = {}
    for r in final_results:
        confidence_counts[r["confidence"]] = confidence_counts.get(r["confidence"], 0) + 1
    tier_fired_counts: dict[str, int] = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for r in final_results:
        for s in r["trace"]:
            tier_fired_counts[s["tier"]] = tier_fired_counts.get(s["tier"], 0) + 1
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
            "canonicals_assigned": int(sum(1 for r in final_results if r["canonical_id"] and r["canonical_id"] != "UNCLASSIFIED")),
            "unclassified": int(confidence_counts.get("UNCLASSIFIED", 0)),
            "unclassified_pct": round(confidence_counts.get("UNCLASSIFIED", 0) / max(len(df), 1) * 100, 2),
            "pass2_upgraded_via_tier_b": pass2_upgraded,
            "clean_mgs": sum(1 for v in mg_rollup_stats.values() if v["clean"]),
            "mixed_mgs": sum(1 for v in mg_rollup_stats.values() if not v["clean"]),
        },
        "clean_mg_map": clean_mg_map,
        "clean_mg_roster": clean_mg_list,
        "mixed_mg_roster": mixed_mg_list,
        "canonical_distribution": canonical_counts,
        "samples_by_confidence": samples_by_conf,
        "sample_cap": SAMPLE_CAP,
    }
    return df, report
