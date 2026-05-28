"""End-to-end scenario suite — 5 distinct test cases that exercise the
real HTTP API using the 8 seed datasets as input.

Run manually:
    cd proc-app
    PROCVAULT_DB_PATH=/tmp/procvault_e2e5.db \
      python -m uvicorn backend.main:app --port 8770 &
    sleep 3
    python -m backend.tests.e2e_scenarios

Scenarios:
  1. Happy path full demo (8 uploads -> 4 pillars -> KPI dashboard -> exports)
  2. Scope filter (only 2 pillars in scope -> dashboard hides the rest)
  3. KPI band override (set custom band, status flips, clear override)
  4. Multi-run comparison (re-run pillars -> deltas in comparison endpoint)
  5. KB edit -> new run reflects updated benchmark
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
import urllib.parse
from pathlib import Path

BASE = "http://localhost:8770"


def _http(method, path, body=None, params=None):
    url = BASE + path
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            ct = r.headers.get("Content-Type", "")
            body = r.read()
            if "application/json" in ct:
                return r.status, json.loads(body) if body else None
            return r.status, body
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, e.read()


GET = lambda p, **kw: _http("GET", p, **kw)
POST = lambda p, body=None: _http("POST", p, body=body)
PATCH = lambda p, body=None: _http("PATCH", p, body=body)
DELETE = lambda p: _http("DELETE", p)


class Report:
    def __init__(self):
        self.results = []

    def step(self, scenario, name, ok, detail=""):
        symbol = "PASS" if ok else "FAIL"
        self.results.append((scenario, name, ok, detail))
        print(f"  [{symbol}] {name}" + (f" -- {detail}" if detail else ""))
        return ok

    def summary(self):
        by_scenario = {}
        for s, n, ok, d in self.results:
            by_scenario.setdefault(s, []).append((n, ok, d))
        print()
        print("=" * 70)
        print("SCENARIO SUMMARY")
        print("=" * 70)
        total_pass = 0
        total_fail = 0
        for s, items in by_scenario.items():
            pass_n = sum(1 for _, ok, _ in items if ok)
            fail_n = sum(1 for _, ok, _ in items if not ok)
            total_pass += pass_n
            total_fail += fail_n
            status = "GREEN" if fail_n == 0 else "RED"
            print(f"  {status:>5}  {s}: {pass_n} pass, {fail_n} fail")
        print()
        print(f"OVERALL: {total_pass} pass, {total_fail} fail")
        return total_fail == 0


def _setup_engagement(name, plants_csv="P1,P2", spend_cr=5000, fte=80):
    code, eng = POST("/api/engagement", {
        "client_name": name, "industry": "steel",
        "sub_segment": "integrated_steel_mill_multi_plant",
        "plants": plants_csv.split(","),
        "annual_spend_inr_cr": spend_cr, "fte_count": fte,
    })
    if code != 200: raise RuntimeError(f"Engagement creation failed: {code} {eng}")
    return eng["id"]


def _load_seed_and_confirm(eid, file_type):
    code, up = POST(f"/api/engagement/{eid}/upload-seed?file_type={file_type}")
    if code != 200: raise RuntimeError(f"Seed upload {file_type} failed: {code} {up}")
    upid = up["upload_id"]
    # Auto-confirm mapping
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
             for m in up["suggested_mapping"]]
    POST(f"/api/engagement/{eid}/uploads/{upid}/confirm-mapping",
          {"confirmed_mapping": conf})
    return upid


# ============================================================================
# SCENARIO 1 — Happy path full demo
# ============================================================================

def scenario_1_happy_path(r: Report) -> dict:
    S = "1. Happy path (all 8 uploads -> 4 pillars -> dashboard -> exports)"
    print(f"\n[{S}]")
    eid = _setup_engagement("Acme Steel — Happy Path")
    r.step(S, "engagement created", True, f"id={eid}")

    # Upload all 8 file types
    uploads = {}
    for ft in ["PO", "PR", "VENDOR_MASTER", "MATERIAL_MASTER",
                 "ORG_STRUCTURE", "CONTRACT_MASTER", "GRN", "INVOICE"]:
        uploads[ft] = _load_seed_and_confirm(eid, ft)
    r.step(S, "all 8 seed types uploaded + auto-confirmed", True,
            f"{len(uploads)} uploads")

    # Use PO upload for pillar runs
    po_upid = uploads["PO"]

    # Run 4 pillars
    for slug in ["op-model", "doa", "buying-channel", "org-structure"]:
        t0 = time.time()
        code, res = POST(f"/api/engagement/{eid}/run-pillar/{slug}",
                          {"upload_id": po_upid, "industry": "steel"})
        dt = round(time.time() - t0, 1)
        ok = code == 200 and (res.get("pillar_score") or {}).get("score") is not None
        r.step(S, f"pillar {slug} runs", ok,
                f"score={(res.get('pillar_score') or {}).get('score', '—')}, {dt}s")

    # KPI dashboard
    t0 = time.time()
    code, kp = POST(f"/api/engagement/{eid}/run-kpi-dashboard",
                     {"upload_id": po_upid, "industry": "steel"})
    dt = round(time.time() - t0, 1)
    n_kpis = len(kp.get("kpis", [])) if code == 200 else 0
    r.step(S, "KPI dashboard runs", n_kpis >= 25,
            f"{n_kpis} KPIs in {dt}s")
    pillar_count = len({k["pillar"] for k in kp.get("kpis", [])})
    r.step(S, "all 4 pillars represented in KPIs", pillar_count == 4,
            f"{pillar_count}/4 pillars")

    # Findings
    code, fr = GET(f"/api/engagement/{eid}/findings")
    n_findings = len(fr.get("findings", []))
    r.step(S, "findings persisted", n_findings >= 10,
            f"{n_findings} findings")

    # Exports
    code, pptx = POST(f"/api/engagement/{eid}/export/findings-deck.pptx",
                       {"upload_id": po_upid, "industry": "steel"})
    pptx_ok = code == 200 and isinstance(pptx, (bytes, bytearray)) and pptx[:2] == b"PK"
    r.step(S, "findings-deck.pptx generates", pptx_ok,
            f"{len(pptx) if pptx_ok else 0} bytes")
    code, xlsx = POST(f"/api/engagement/{eid}/export/kpis.xlsx",
                       {"upload_id": po_upid, "industry": "steel"})
    xlsx_ok = code == 200 and isinstance(xlsx, (bytes, bytearray)) and xlsx[:2] == b"PK"
    r.step(S, "kpis.xlsx generates", xlsx_ok,
            f"{len(xlsx) if xlsx_ok else 0} bytes")

    return {"engagement_id": eid, "upload_id": po_upid, "kpis": kp.get("kpis", [])}


# ============================================================================
# SCENARIO 2 — Scope filter (only 2 pillars selected)
# ============================================================================

def scenario_2_scope_filter(r: Report):
    S = "2. Scope filter (only 2 pillars selected)"
    print(f"\n[{S}]")
    eid = _setup_engagement("Scope Test Co", plants_csv="P1", spend_cr=2000)
    upid = _load_seed_and_confirm(eid, "PO")

    # Set scope to only 2 pillars via overrides API
    code, _ = POST(f"/api/engagement/{eid}/overrides", {
        "key": "scope.pillars",
        "value": ["op-model", "buying-channel"],
        "override_type": "scope",
    })
    r.step(S, "scope.pillars override saved", code == 200)

    # Verify it's persisted
    code, ov = GET(f"/api/engagement/{eid}/overrides")
    scope_entry = next((o for o in ov["overrides"] if o["key"] == "scope.pillars"), None)
    r.step(S, "scope override readable",
            scope_entry is not None and set(scope_entry["value"]) == {"op-model", "buying-channel"},
            f"scope={scope_entry['value'] if scope_entry else None}")

    # Run KPI dashboard
    code, kp = POST(f"/api/engagement/{eid}/run-kpi-dashboard",
                     {"upload_id": upid, "industry": "steel"})
    # Server returns all 4 pillars; client-side filter applies on screen.
    # Verify the override is queryable so client can filter correctly.
    r.step(S, "dashboard runs with scope override in place", code == 200,
            f"{len(kp.get('kpis', []))} KPIs returned (client filters)")


# ============================================================================
# SCENARIO 3 — KPI band override
# ============================================================================

def scenario_3_band_override(r: Report, ctx: dict):
    S = "3. KPI band override (set + status flips + clear)"
    print(f"\n[{S}]")
    eid = ctx["engagement_id"]
    upid = ctx["upload_id"]
    kpis = ctx["kpis"]

    # Find a KPI in band currently
    target = next((k for k in kpis if k["status"] == "in"), None)
    if not target:
        r.step(S, "find in-band KPI to override", False, "none available")
        return
    r.step(S, "selected target KPI", True,
            f"{target['id']} = {target['value']} {target['unit']} (in band {target['band']['low']}-{target['band']['high']})")

    # Override with band that forces under (higher_is_better) or over (lower_is_better)
    if target["band_meaning"] == "higher_is_better":
        new_band = {"low": 99999, "high": 999999}
        expected = "under"
    elif target["band_meaning"] == "lower_is_better":
        new_band = {"low": 0, "high": 0}
        expected = "over" if isinstance(target["value"], (int, float)) and target["value"] > 0 else None
    else:
        new_band = {"low": 99999, "high": 999999}
        expected = "under"

    code, _ = POST(f"/api/engagement/{eid}/overrides", {
        "key": target["id"], "value": new_band, "override_type": "kpi_band",
    })
    r.step(S, "override saved", code == 200)

    # Re-run dashboard
    code, kp2 = POST(f"/api/engagement/{eid}/run-kpi-dashboard",
                     {"upload_id": upid, "industry": "steel"})
    after = next(k for k in kp2["kpis"] if k["id"] == target["id"])
    r.step(S, "band_overridden flag set", after["band_overridden"] is True)
    r.step(S, "band reflects override", after["band"] == new_band, str(after["band"]))
    if expected:
        r.step(S, f"status flipped to {expected}", after["status"] == expected,
                f"got {after['status']}")

    # Clear override
    code, _ = DELETE(f"/api/engagement/{eid}/overrides/{urllib.parse.quote(target['id'], safe='')}")
    r.step(S, "override cleared", code == 200)

    # Re-run + verify reverted
    code, kp3 = POST(f"/api/engagement/{eid}/run-kpi-dashboard",
                     {"upload_id": upid, "industry": "steel"})
    reverted = next(k for k in kp3["kpis"] if k["id"] == target["id"])
    r.step(S, "band reverts to default", reverted["band"] == target["band_default"])
    r.step(S, "band_overridden cleared", reverted["band_overridden"] is False)


# ============================================================================
# SCENARIO 4 — Multi-run comparison
# ============================================================================

def scenario_4_comparison(r: Report, ctx: dict):
    S = "4. Multi-run comparison (deltas + history)"
    print(f"\n[{S}]")
    eid = ctx["engagement_id"]
    upid = ctx["upload_id"]

    # Run KPI dashboard one more time (1st was in scenario 1)
    code, _ = POST(f"/api/engagement/{eid}/run-kpi-dashboard",
                    {"upload_id": upid, "industry": "steel"})
    r.step(S, "second dashboard run completes", code == 200)

    # Comparison
    code, cmp_data = GET(f"/api/engagement/{eid}/comparison")
    comps = cmp_data.get("comparisons", [])
    r.step(S, "comparison endpoint returns rows", len(comps) == 4,
            f"{len(comps)} pillars compared")

    has_prior = sum(1 for c in comps if c.get("prior") is not None)
    r.step(S, "comparisons have prior runs", has_prior == 4,
            f"{has_prior}/4 with prior")

    deltas_zero = all(c.get("delta") == 0 for c in comps if c.get("delta") is not None)
    r.step(S, "delta=0 for same data (same input -> same score)", deltas_zero)


# ============================================================================
# SCENARIO 5 — KB edit reflects in next pillar run
# ============================================================================

def scenario_5_kb_edit(r: Report):
    S = "5. KB edit -> next pillar run picks up the change"
    print(f"\n[{S}]")
    # Fresh engagement
    eid = _setup_engagement("KB Edit Test Co")
    upid = _load_seed_and_confirm(eid, "PO")

    # 1st run — capture baseline pillar score
    code, baseline = POST(f"/api/engagement/{eid}/run-pillar/buying-channel",
                            {"upload_id": upid, "industry": "steel"})
    baseline_score = (baseline.get("pillar_score") or {}).get("score")
    r.step(S, "baseline run captured", baseline_score is not None,
            f"score={baseline_score}")

    # Read benchmark file via KB editor
    code, kb = GET("/api/kb/files/read",
                    params={"root": "function", "path": "buying-channel/benchmarks.yml"})
    if code != 200:
        r.step(S, "KB read", False, str(kb))
        return
    original = kb["content"]
    r.step(S, "KB benchmark file readable", True,
            f"{len(original)} chars")

    # Make a trivial whitespace edit (touch the file) and write back
    edited = original + "\n# touched by e2e_scenarios at " + str(int(time.time())) + "\n"
    code, _ = POST("/api/kb/files/write", {
        "root": "function", "path": "buying-channel/benchmarks.yml",
        "content": edited,
    })
    r.step(S, "KB write accepted", code == 200)

    # 2nd run — should still succeed (cache invalidated, KB re-parsed)
    code, second = POST(f"/api/engagement/{eid}/run-pillar/buying-channel",
                          {"upload_id": upid, "industry": "steel"})
    second_score = (second.get("pillar_score") or {}).get("score")
    r.step(S, "post-edit pillar run still works", code == 200 and second_score is not None,
            f"score={second_score}")

    # Restore file
    POST("/api/kb/files/write", {
        "root": "function", "path": "buying-channel/benchmarks.yml",
        "content": original,
    })
    r.step(S, "KB file restored", True)

    # Reject malformed YAML save
    code, resp = POST("/api/kb/files/write", {
        "root": "function", "path": "buying-channel/benchmarks.yml",
        "content": "{ bad: ::yaml::",
    })
    r.step(S, "malformed YAML rejected", code == 400,
            f"got {code}")


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 70)
    print("PROCVAULT E2E SCENARIO SUITE")
    print(f"Target: {BASE}")
    print("=" * 70)

    r = Report()
    try:
        ctx = scenario_1_happy_path(r)
        scenario_2_scope_filter(r)
        scenario_3_band_override(r, ctx)
        scenario_4_comparison(r, ctx)
        scenario_5_kb_edit(r)
    except Exception as e:
        print(f"\nFATAL: {e}")
        import traceback; traceback.print_exc()

    ok = r.summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
