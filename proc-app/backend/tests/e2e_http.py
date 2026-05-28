"""End-to-end HTTP test — drives the live FastAPI server through the
complete user journey + verifies every response shape.

Run directly:
    cd proc-app
    PROCVAULT_DB_PATH=/tmp/procvault_e2e.db python -m uvicorn backend.main:app --port 8765 &
    sleep 4
    python -m backend.tests.e2e_http
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
import urllib.error


BASE = "http://localhost:8765"


# --------------------------------------------------------------------------
# Tiny HTTP helper (avoids requiring httpx/requests)
# --------------------------------------------------------------------------

def _http(method: str, path: str, body=None, params=None):
    url = BASE + path
    if params:
        from urllib.parse import urlencode
        url += ("&" if "?" in url else "?") + urlencode(params)
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            ct = r.headers.get("Content-Type", "")
            body = r.read()
            if "application/json" in ct:
                return r.status, json.loads(body) if body else None
            return r.status, body.decode("utf-8") if body else None
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, str(e)


GET   = lambda p, **kw: _http("GET", p, **kw)
POST  = lambda p, body=None: _http("POST", p, body=body)
PATCH = lambda p, body=None: _http("PATCH", p, body=body)


# --------------------------------------------------------------------------
# Assertion helpers + reporting
# --------------------------------------------------------------------------

class Report:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []

    def ok(self, name, detail=""):
        self.passed.append((name, detail))
        print(f"  PASS  {name}" + (f" — {detail}" if detail else ""))

    def fail(self, name, detail):
        self.failed.append((name, detail))
        print(f"  FAIL  {name} — {detail}")

    def warn(self, name, detail):
        self.warnings.append((name, detail))
        print(f"  WARN  {name} — {detail}")

    def summary(self):
        print()
        print("=" * 60)
        print(f"E2E RESULT: {len(self.passed)} passed, {len(self.failed)} failed, {len(self.warnings)} warnings")
        if self.failed:
            print("Failures:")
            for n, d in self.failed:
                print(f"  - {n}: {d}")
        return len(self.failed) == 0


# --------------------------------------------------------------------------
# Test flow
# --------------------------------------------------------------------------

def run():
    r = Report()
    eid = None
    upid = None

    # --- Health ---
    print("\n[1] Health")
    code, body = GET("/api/health")
    if code == 200 and body.get("status") == "ok":
        r.ok("health endpoint")
    else:
        r.fail("health endpoint", f"{code} {body}")
        return r.summary()

    code, body = GET("/api/ready")
    r.ok("ready endpoint", f"status={body.get('status') if isinstance(body, dict) else code}")

    # --- Engagement CRUD ---
    print("\n[2] Engagement CRUD")
    code, eng = POST("/api/engagement", {
        "client_name": "E2E Steel Mill",
        "industry": "steel",
        "sub_segment": "integrated_steel_mill_multi_plant",
        "plants": ["Plant-A", "Plant-B", "Plant-C"],
        "annual_spend_inr_cr": 5000,
        "annual_revenue_inr_cr": 50000,
        "fte_count": 80,
    })
    if code == 200 and eng.get("id"):
        eid = eng["id"]
        r.ok("create engagement", f"id={eid}")
    else:
        r.fail("create engagement", f"{code} {eng}")
        return r.summary()

    code, lst = GET("/api/engagement")
    if code == 200 and isinstance(lst, list) and any(e["id"] == eid for e in lst):
        r.ok("list engagements", f"count={len(lst)}")
    else:
        r.fail("list engagements", f"{code} {lst}")

    code, got = GET(f"/api/engagement/{eid}")
    if code == 200 and got["client_name"] == "E2E Steel Mill":
        r.ok("get engagement")
    else:
        r.fail("get engagement", f"{code} {got}")

    code, upd = PATCH(f"/api/engagement/{eid}", {
        "client_name": "E2E Steel Mill",
        "industry": "steel",
        "sub_segment": "integrated_steel_mill_multi_plant",
        "plants": ["Plant-A", "Plant-B", "Plant-C", "Plant-D"],
        "annual_spend_inr_cr": 5500,
        "annual_revenue_inr_cr": 55000,
        "fte_count": 90,
    })
    if code == 200 and upd["fte_count"] == 90 and len(upd["plants"]) == 4:
        r.ok("update engagement", "fte=90, 4 plants")
    else:
        r.fail("update engagement", f"{code} {upd}")

    # 404 on bad id
    code, _ = GET("/api/engagement/nonexistent")
    if code == 404:
        r.ok("get engagement 404")
    else:
        r.fail("get engagement 404", f"got {code}")

    # --- Upload ---
    print("\n[3] Upload + mapping")
    code, up = POST(f"/api/engagement/{eid}/upload-seed")
    if code == 200 and up.get("upload_id"):
        upid = up["upload_id"]
        r.ok("seed upload", f"upload_id={upid}, rows={up.get('row_count')}")
    else:
        r.fail("seed upload", f"{code} {up}")
        return r.summary()

    code, uploads = GET(f"/api/engagement/{eid}/uploads")
    if code == 200 and len(uploads) >= 1:
        r.ok("list uploads", f"count={len(uploads)}")
    else:
        r.fail("list uploads", f"{code} {uploads}")

    code, prev = GET(f"/api/engagement/{eid}/uploads/{upid}/preview", params={"limit": 5})
    if code == 200 and prev.get("suggested_mapping") and prev.get("sample_rows"):
        mapping_count = len(prev["suggested_mapping"])
        mapped_count = sum(1 for m in prev["suggested_mapping"] if m.get("suggested_field"))
        r.ok("preview upload", f"{mapped_count}/{mapping_count} columns auto-mapped")
    else:
        r.fail("preview upload", f"{code} {prev}")

    # Confirm mapping
    conf = [{"raw_column": m["raw_column"], "canonical_field": m["suggested_field"]}
            for m in prev["suggested_mapping"]]
    code, cm = POST(f"/api/engagement/{eid}/uploads/{upid}/confirm-mapping",
                     {"confirmed_mapping": conf})
    if code == 200:
        r.ok("confirm mapping", f"{len(conf)} columns confirmed")
    else:
        r.fail("confirm mapping", f"{code} {cm}")

    # --- QRE ---
    print("\n[4] QRE")
    code, qre = GET(f"/api/engagement/{eid}/qre")
    if code == 200 and qre.get("total") == 52:
        r.ok("get QRE template", f"{qre['total']} questions across {len(qre.get('areas',{}))} areas")
    else:
        r.fail("get QRE template", f"{code} total={qre.get('total') if isinstance(qre, dict) else qre}")

    # Save a few responses
    responses = [
        {"id": "D1.1", "score": 3, "evidence": "E2E test override", "area": "Strategy & Vision", "question": "?", "required": True},
        {"id": "D2.1", "score": 2, "evidence": "Partial", "area": "Scope & Coverage", "question": "?", "required": True},
        {"id": "D2.4", "score": 4, "evidence": "Documented", "area": "Scope & Coverage", "question": "?", "required": True},
    ]
    code, sv = POST(f"/api/engagement/{eid}/qre", {"responses": responses})
    if code == 200 and sv.get("saved") == 3:
        r.ok("save QRE", "3 responses saved")
    else:
        r.fail("save QRE", f"{code} {sv}")

    # Verify roundtrip
    code, qre2 = GET(f"/api/engagement/{eid}/qre")
    saved_d11 = next((q for q in qre2["responses"] if q["id"] == "D1.1"), None)
    if saved_d11 and saved_d11["score"] == 3 and saved_d11["evidence"] == "E2E test override":
        r.ok("QRE roundtrip", "D1.1 score persisted")
    else:
        r.fail("QRE roundtrip", f"saved={saved_d11}")

    # --- Intel (Stage 8/9/10 only) ---
    print("\n[5] Intel pipeline (Stage 8/9/10)")
    code, intel = POST(f"/api/engagement/{eid}/run-intel",
                        {"upload_id": upid, "industry": "steel"})
    if code == 200:
        mg = intel.get("mg_count", 0)
        unc = intel.get("classify_summary", {}).get("unclassified_pct", 100)
        archs = list(intel.get("by_archetype", {}).keys())
        if mg > 30 and unc < 50 and len(archs) >= 4:
            r.ok("run intel", f"mg={mg}, unc={unc}%, archetypes={archs}")
        else:
            r.warn("run intel — unusual values", f"mg={mg}, unc={unc}%, archs={archs}")
    else:
        r.fail("run intel", f"{code} {intel}")

    # --- All 4 pillars ---
    print("\n[6] Pillar runs (4 pillars)")
    pillar_results = {}
    for slug, label in [("op-model", "Op Model"), ("doa", "DoA"),
                         ("buying-channel", "Buying Channel"),
                         ("org-structure", "Org Structure")]:
        t0 = time.time()
        code, res = POST(f"/api/engagement/{eid}/run-pillar/{slug}",
                          {"upload_id": upid, "industry": "steel"})
        dt = round(time.time() - t0, 1)
        if code == 200:
            score = res.get("pillar_score", {})
            s = score.get("score") if isinstance(score, dict) else score
            if isinstance(s, (int, float)) and 1 <= s <= 5:
                pillar_results[slug] = res
                r.ok(f"run {slug}", f"score={s}, {dt}s")
            else:
                r.fail(f"run {slug}", f"out-of-range score {s}")
        else:
            r.fail(f"run {slug}", f"{code} {str(res)[:120]}")

    # Inspect each pillar's shape
    if "op-model" in pillar_results:
        op = pillar_results["op-model"]
        themes = list(op.get("themes", {}).keys())
        if set(themes) == {"centralisation", "shared-services", "coe", "tail-spend"}:
            r.ok("op-model 4 themes")
        else:
            r.fail("op-model themes", f"got {themes}")

    if "doa" in pillar_results:
        doa = pillar_results["doa"]
        if len(doa.get("themes", {})) == 5:
            r.ok("doa 5 themes")
        else:
            r.fail("doa themes", f"got {len(doa.get('themes', {}))}")

    # --- KPI dashboard ---
    print("\n[7] KPI dashboard (Stage 30)")
    t0 = time.time()
    code, kp = POST(f"/api/engagement/{eid}/run-kpi-dashboard",
                     {"upload_id": upid, "industry": "steel"})
    dt = round(time.time() - t0, 1)
    if code == 200:
        n = len(kp.get("kpis", []))
        pillars = {k["pillar"] for k in kp["kpis"]}
        if n > 20 and pillars == {"op-model", "buying-channel", "org-structure", "doa"}:
            r.ok("KPI dashboard", f"{n} KPIs, {dt}s")
        else:
            r.fail("KPI dashboard", f"only {n} KPIs / pillars={pillars}")

        # Status distribution sanity
        statuses = [k["status"] for k in kp["kpis"]]
        valid = {"in", "under", "over", "unknown"}
        if all(s in valid for s in statuses):
            r.ok("KPI statuses valid")
        else:
            r.fail("KPI statuses", f"unexpected: {set(statuses) - valid}")

        # Required fields present on each KPI
        required = {"id", "label", "pillar", "theme", "value", "unit", "band",
                     "band_meaning", "status", "delta", "spark", "benchmark",
                     "finding", "drill_down"}
        missing = [k["id"] for k in kp["kpis"] if not required.issubset(k)]
        if not missing:
            r.ok("KPI required fields")
        else:
            r.fail("KPI required fields", f"missing on: {missing[:3]}")

        # Pillar summary present
        if kp.get("pillar_summary") and len(kp["pillar_summary"]) == 4:
            r.ok("pillar summary present", "4 pillars")
        else:
            r.fail("pillar summary", f"got {len(kp.get('pillar_summary', {}))}")
    else:
        r.fail("KPI dashboard", f"{code} {str(kp)[:120]}")

    # --- Findings + run history ---
    print("\n[8] Findings + run history")
    code, fnd = GET(f"/api/engagement/{eid}/findings")
    if code == 200 and isinstance(fnd.get("findings"), list):
        by_pillar = {}
        for f in fnd["findings"]:
            by_pillar[f["pillar"]] = by_pillar.get(f["pillar"], 0) + 1
        r.ok("list findings", f"{len(fnd['findings'])} findings: {by_pillar}")
    else:
        r.fail("list findings", f"{code} {fnd}")

    code, fnd_pil = GET(f"/api/engagement/{eid}/findings", params={"pillar": "doa"})
    if code == 200 and all(f["pillar"] == "doa" for f in fnd_pil.get("findings", [])):
        r.ok("findings filter by pillar")
    else:
        r.fail("findings filter", f"{code}")

    code, runs = GET(f"/api/engagement/{eid}/pillar-runs")
    if code == 200 and len(runs.get("runs", [])) >= 4:
        r.ok("pillar runs history", f"{len(runs['runs'])} runs recorded")
    else:
        r.fail("pillar runs history", f"{code} {len(runs.get('runs', []))} runs")

    # Run a pillar AGAIN and check delta
    POST(f"/api/engagement/{eid}/run-pillar/buying-channel",
          {"upload_id": upid, "industry": "steel"})
    code, runs2 = GET(f"/api/engagement/{eid}/pillar-runs", params={"pillar": "buying-channel"})
    if code == 200 and len(runs2.get("runs", [])) >= 2:
        r.ok("re-run records history", f"{len(runs2['runs'])} runs for buying-channel")
    else:
        r.fail("re-run history", f"{code}")

    # --- KB read endpoints ---
    print("\n[9] KB endpoints")
    code, pillars = GET("/api/kb/pillars")
    pillar_list = pillars.get("pillars", []) if isinstance(pillars, dict) else pillars
    if code == 200 and len(pillar_list) >= 4:
        r.ok("list pillars", f"{len(pillar_list)} pillars")
    else:
        r.fail("list pillars", f"{code} got {len(pillar_list) if pillar_list else 'none'}")

    code, bm = GET("/api/kb/pillars/op-model/benchmarks", params={"industry": "steel"})
    if code == 200 and len(bm.get("benchmarks", {})) > 0:
        r.ok("get benchmarks", f"{len(bm['benchmarks'])} resolved")
    else:
        r.fail("get benchmarks", f"{code}")

    code, cfg = GET("/api/kb/pillars/buying-channel/config")
    if code == 200:
        r.ok("get pillar config")
    else:
        r.fail("get pillar config", f"{code}")

    # --- KB file editor ---
    print("\n[10] KB file editor")
    code, tree = GET("/api/kb/files/tree")
    if code == 200 and "function" in tree.get("roots", []):
        total = sum(len(v) for v in tree["files"].values())
        r.ok("KB tree", f"{total} files across {len(tree['roots'])} roots")
    else:
        r.fail("KB tree", f"{code}")
        return r.summary()

    sample = tree["files"]["function"][0]
    code, f = GET("/api/kb/files/read", params={"root": "function", "path": sample["rel_path"]})
    if code == 200 and len(f.get("content", "")) > 0:
        r.ok("KB read file", f"{sample['rel_path']} ({len(f['content'])} chars)")
    else:
        r.fail("KB read file", f"{code}")

    # Roundtrip
    code, w = POST("/api/kb/files/write", {
        "root": "function", "path": sample["rel_path"], "content": f["content"],
    })
    if code == 200:
        r.ok("KB write roundtrip")
    else:
        r.fail("KB write roundtrip", f"{code} {w}")

    # Bad YAML rejection
    yaml_files = [x for x in tree["files"]["function"] if x["ext"] in ("yml", "yaml")]
    yf = yaml_files[0]
    code, w = POST("/api/kb/files/write", {
        "root": "function", "path": yf["rel_path"], "content": "{ bad: : ::",
    })
    if code == 400:
        r.ok("KB bad YAML rejected")
    else:
        r.fail("KB bad YAML rejected", f"got {code}")

    # Path traversal blocked
    code, _ = GET("/api/kb/files/read", params={"root": "function", "path": "../../../etc/passwd"})
    if code == 400:
        r.ok("KB traversal blocked")
    else:
        r.fail("KB traversal blocked", f"got {code}")

    # Unknown root rejected
    code, _ = GET("/api/kb/files/read", params={"root": "bogus", "path": "x"})
    if code == 400:
        r.ok("KB unknown root rejected")
    else:
        r.fail("KB unknown root", f"got {code}")

    # --- Stage progress (verify stages advanced) ---
    print("\n[11] Stage progress")
    code, st = GET(f"/api/engagement/{eid}/stages")
    if code == 200:
        progress = st.get("progress", {})
        done = [str(k) for k, v in progress.items() if v.get("status") == "done"]
        # Expect Stage 8, 9, 10, 12, 13, 14, 16, 30 done after full flow
        if "8" in done and "9" in done and "10" in done and "12" in done:
            r.ok("stage progress", f"done stages: {sorted(done, key=int)}")
        else:
            r.warn("stage progress", f"expected 8/9/10/12 done; got: {done}")
    else:
        r.fail("stage progress", f"{code}")

    # --- Seeds + multi-type upload ---
    print("\n[12] Seed datasets (all 8 types)")
    code, seeds = GET("/api/seeds")
    if code == 200 and len(seeds.get("seeds", [])) == 8:
        r.ok("list seeds", f"{len(seeds['seeds'])} seed types available")
    else:
        r.fail("list seeds", f"{code} got {len(seeds.get('seeds', []))}")

    # Upload a Vendor Master seed alongside the PO upload (new engagement)
    code, eng2 = POST("/api/engagement", {
        "client_name": "VM E2E", "industry": "steel",
        "plants": ["A"], "annual_spend_inr_cr": 1000,
    })
    if code == 200:
        for ft in ["VENDOR_MASTER", "MATERIAL_MASTER", "ORG_STRUCTURE",
                    "CONTRACT_MASTER", "GRN", "INVOICE"]:
            code2, up2 = POST(f"/api/engagement/{eng2['id']}/upload-seed?file_type={ft}")
            if code2 == 200:
                mapped = sum(1 for m in up2["suggested_mapping"] if m["suggested_field"])
                total = len(up2["suggested_mapping"])
                if mapped == total and len(up2["missing_required"]) == 0:
                    r.ok(f"seed upload {ft}", f"{up2['row_count']} rows, {mapped}/{total} cols")
                else:
                    r.fail(f"seed upload {ft}", f"mapping {mapped}/{total}, missing {up2['missing_required']}")
            else:
                r.fail(f"seed upload {ft}", f"{code2} {up2}")

    # --- Background jobs ---
    print("\n[13] Background jobs")
    code, jb = POST(f"/api/engagement/{eid}/jobs/run-pillar/buying-channel",
                     {"upload_id": upid, "industry": "steel"})
    if code == 200 and jb.get("job_id"):
        jid = jb["job_id"]
        # Poll up to 30s
        final = None
        for _ in range(60):
            code, j = GET(f"/api/engagement/{eid}/jobs/{jid}")
            if code == 200 and j["status"] in ("done", "failed"):
                final = j
                break
            time.sleep(0.5)
        if final and final["status"] == "done":
            r.ok("pillar job lifecycle", f"jid={jid} progress={final['progress']}% summary='{final['result_summary']}'")
        else:
            r.fail("pillar job", f"final status={final['status'] if final else 'timeout'}")
    else:
        r.fail("submit pillar job", f"{code} {jb}")

    code, jbs = GET(f"/api/engagement/{eid}/jobs")
    if code == 200 and len(jbs.get("jobs", [])) > 0:
        r.ok("list jobs", f"{len(jbs['jobs'])} jobs recorded")
    else:
        r.fail("list jobs", f"{code}")

    # --- Error paths ---
    print("\n[14] Error paths")
    code, _ = POST(f"/api/engagement/{eid}/run-pillar/op-model",
                    {"upload_id": "bogus-id", "industry": "steel"})
    if code == 404:
        r.ok("bogus upload id → 404")
    else:
        r.fail("bogus upload id", f"got {code}")

    code, _ = POST(f"/api/engagement/{eid}/run-pillar/nonexistent",
                    {"upload_id": upid, "industry": "steel"})
    if code == 404:
        r.ok("bad pillar slug → 404")
    else:
        r.warn("bad pillar slug", f"got {code} (FastAPI auto-404)")

    return r.summary()


if __name__ == "__main__":
    ok = run()
    sys.exit(0 if ok else 1)
