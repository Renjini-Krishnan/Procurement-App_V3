"""Generate consistent synthetic seed data for all 8 file types.

Reads demo_po_dump.csv to extract the universe (vendors, MGs, plants,
materials), then emits:
  - demo_vendor_master.csv
  - demo_material_master.csv
  - demo_org_structure.csv
  - demo_contract_master.csv
  - demo_grn.csv
  - demo_invoice.csv

All datasets share the same vendor IDs, MG codes, plant codes so cross-file
joins work for downstream pillars (Material Master quality, PR-to-PO,
Post-PO, Supplier).
"""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

SEED_DIR = Path(__file__).resolve().parent
random.seed(20260101)


def _format_date(d: date) -> str:
    return d.strftime("%d-%m-%Y")


def _parse_date(s: str) -> date:
    return datetime.strptime(str(s), "%d-%m-%Y").date()


# ============================================================================
# Read PO dump → extract universe
# ============================================================================

def load_po_universe() -> dict:
    po = pd.read_csv(SEED_DIR / "demo_po_dump.csv", low_memory=False)
    # Vendor list
    vendor_df = po[["Vendor_Number", "Vendor_Name"]].drop_duplicates()
    vendor_df = vendor_df.dropna()
    # Plants
    plants = sorted(po["Plant"].dropna().unique().tolist())
    # Material groups
    mg_df = po[["Material_Group", "Material_Group_Desc"]].drop_duplicates()
    mg_df = mg_df.dropna()
    # Date range
    dates = pd.to_datetime(po["PO_Creation_Date"], format="%d-%m-%Y", errors="coerce")
    return {
        "po": po,
        "vendors": vendor_df.values.tolist(),
        "plants": plants,
        "mgs": mg_df.values.tolist(),
        "date_min": dates.min(),
        "date_max": dates.max(),
    }


# ============================================================================
# Vendor Master
# ============================================================================

def gen_vendor_master(universe: dict) -> pd.DataFrame:
    states = ["MH", "GJ", "KA", "TN", "WB", "JH", "OR", "AP", "TG", "DL", "UP", "RJ"]
    cities_by_state = {
        "MH": ["Mumbai", "Pune", "Nagpur"], "GJ": ["Ahmedabad", "Surat"],
        "KA": ["Bengaluru", "Mangalore"], "TN": ["Chennai", "Coimbatore"],
        "WB": ["Kolkata"], "JH": ["Jamshedpur", "Ranchi"],
        "OR": ["Bhubaneswar", "Angul"], "AP": ["Visakhapatnam", "Vijayawada"],
        "TG": ["Hyderabad"], "DL": ["New Delhi"], "UP": ["Noida", "Kanpur"],
        "RJ": ["Jaipur", "Udaipur"],
    }
    vendor_types = ["Manufacturer", "Trader", "Service Provider", "Government", "Affiliate"]
    tiers = ["Strategic", "Preferred", "Approved", "Transactional"]
    tier_weights = [0.08, 0.22, 0.5, 0.20]
    payment_terms = ["NET 30", "NET 45", "NET 60", "NET 90", "EOM30", "AT SIGHT", "ADVANCE"]

    rows = []
    seen_vids = set()
    for vid, vname in universe["vendors"]:
        if str(vid) in seen_vids:
            continue
        seen_vids.add(str(vid))
        # Vendor name often contains hints
        name_u = str(vname).upper()
        if any(k in name_u for k in ("LOGISTICS", "SHIPPING", "FREIGHT", "TRANSPORT")):
            vt = "Service Provider"
        elif any(k in name_u for k in ("CONTRACT", "CLUSTER", "CONSULTING")):
            vt = "Service Provider"
        elif "GOVERNMENT" in name_u or "RAILWAY" in name_u:
            vt = "Government"
        elif "TRADER" in name_u or "ENTERPRISES" in name_u:
            vt = "Trader"
        else:
            vt = random.choice(vendor_types)
        st = random.choice(states)
        city = random.choice(cities_by_state[st])
        tier = random.choices(tiers, weights=tier_weights, k=1)[0]
        created = universe["date_min"] - timedelta(days=random.randint(60, 3650))
        is_msme = random.random() < 0.25
        msme_class = random.choice(["Micro", "Small", "Medium"]) if is_msme else "No"
        # PAN: 10 char, AAAAA9999A
        pan = "".join(random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(5)) \
              + str(random.randint(1000, 9999)) + random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        gstin = f"{random.randint(10, 36):02d}{pan}{random.randint(1, 9)}Z{random.randint(0,9)}"
        rows.append({
            "Vendor_Number": vid,
            "Vendor_Name": vname,
            "Status": "Active" if random.random() > 0.05 else "Blocked",
            "Created_Date": _format_date(created),
            "Vendor_Type": vt,
            "Country": "IN",
            "City": city,
            "State": st,
            "PAN": pan,
            "GSTIN": gstin,
            "MSME": msme_class,
            "Payment_Terms": random.choice(payment_terms),
            "Classification_Tier": tier,
            "Parent_Vendor": "" if random.random() > 0.1 else f"V{random.randint(1, 60):04d}",
        })
    return pd.DataFrame(rows)


# ============================================================================
# Material Master
# ============================================================================

def gen_material_master(universe: dict) -> pd.DataFrame:
    po = universe["po"]
    # Material_Number column already exists per PO row; collect uniques + MG
    if "Material_Number" in po.columns:
        mat_pairs = po[["Material_Number", "Material_Group", "Material_Group_Desc"]].dropna(subset=["Material_Number"]).drop_duplicates(subset=["Material_Number"])
    else:
        mat_pairs = pd.DataFrame({"Material_Number": [], "Material_Group": [], "Material_Group_Desc": []})

    # Material types by MG description keywords
    def mtart_for(desc: str) -> str:
        d = str(desc or "").upper()
        if any(k in d for k in ("BEARING", "SPARE", "VALVE", "GASKET", "BOLT")): return "ERSA"
        if any(k in d for k in ("STEEL", "IRON ORE", "COAL", "ROLL", "INGOT")): return "ROH"
        if any(k in d for k in ("FINISHED", "BILLET", "COIL")): return "FERT"
        if any(k in d for k in ("CONTRACT", "AMC", "REPAIR", "MAINTENANCE")): return "DIEN"
        if any(k in d for k in ("EQUIPMENT", "MACHINE", "PLANT")): return "ANLZ"
        return "HALB"

    def uom_for(mtart: str) -> str:
        return {"ERSA": "EA", "ROH": "TON", "FERT": "TON", "DIEN": "ACT", "ANLZ": "EA", "HALB": "KG"}[mtart]

    rows = []
    for _, r in mat_pairs.iterrows():
        mat = str(r["Material_Number"])
        mg = str(r.get("Material_Group", ""))
        desc = str(r.get("Material_Group_Desc", ""))
        mtart = mtart_for(desc)
        created = universe["date_min"] - timedelta(days=random.randint(30, 2000))
        rows.append({
            "Material_Number": mat,
            "Material_Description": f"{desc[:40]} — Var {random.randint(1, 12)}",
            "Material_Group": mg,
            "Material_Group_Desc": desc,
            "Material_Type": mtart,
            "Base_UoM": uom_for(mtart),
            "Created_Date": _format_date(created),
            "Created_By": f"USER{random.randint(1, 12):03d}",
            "Plant": random.choice(universe["plants"]) if random.random() > 0.4 else "",
            "Industry_Sector": "M",  # Mechanical Engineering / Steel default
            "Deletion_Flag": "X" if random.random() < 0.03 else "",
            "HSN_SAC_Code": str(random.randint(72010000, 99999999)),
            "Classification": random.choices(["A", "B", "C"], weights=[0.2, 0.3, 0.5], k=1)[0],
            "Standard_Price": round(random.uniform(50, 500_000), 2),
        })
    return pd.DataFrame(rows)


# ============================================================================
# Org Structure
# ============================================================================

def gen_org_structure(universe: dict, n: int = 80) -> pd.DataFrame:
    """Build a procurement org chart: 1 CPO → 4 Heads → ~12 Managers → rest buyers/specialists."""
    plants = universe["plants"]
    grades = {
        "L9": "CPO",
        "L8": "Head — Direct / Indirect / CoE / Operations",
        "L7": "Sr. Category Manager",
        "L6": "Category Manager",
        "L5": "Sr. Buyer",
        "L4": "Buyer",
        "L3": "Buyer / Analyst",
        "L2": "Sourcing Analyst",
    }
    roles_by_grade = {
        "L9": ["Chief Procurement Officer"],
        "L8": ["Head Direct Procurement", "Head Indirect Procurement", "Head CoE", "Head Procurement Ops"],
        "L7": ["Sr. Category Manager — Steel", "Sr. Category Manager — Coal",
               "Sr. Category Manager — Indirect", "Sr. Category Manager — Services"],
        "L6": ["Category Manager"], "L5": ["Sr. Buyer"], "L4": ["Buyer"],
        "L3": ["Buyer", "Analyst"], "L2": ["Sourcing Analyst", "Junior Analyst"],
    }
    sub_functions = ["Direct", "Indirect", "Services", "CoE", "Operations", "Strategy", "Compliance"]

    rows = []
    cpo_id = "EMP00001"
    rows.append({
        "Employee_ID": cpo_id, "Employee_Name": "A. Sharma",
        "Role_Title": "Chief Procurement Officer", "Role_Grade": "L9",
        "Reports_To": "", "Function": "Procurement", "Sub_Function": "Strategy",
        "Plant": "HQ", "Hire_Date": _format_date(date(2017, 4, 1)),
        "CTC_INR_Lakhs": 280, "Employment_Type": "Permanent", "Status": "Active",
        "Skill_Specialisation": "Strategy",
    })
    heads = []
    for i, role in enumerate(roles_by_grade["L8"]):
        eid = f"EMP{i+2:05d}"
        heads.append(eid)
        rows.append({
            "Employee_ID": eid, "Employee_Name": f"Head {i+1}",
            "Role_Title": role, "Role_Grade": "L8",
            "Reports_To": cpo_id, "Function": "Procurement",
            "Sub_Function": sub_functions[i],
            "Plant": "HQ", "Hire_Date": _format_date(date(2018+i, 6, 1)),
            "CTC_INR_Lakhs": random.randint(120, 180), "Employment_Type": "Permanent", "Status": "Active",
            "Skill_Specialisation": sub_functions[i],
        })
    # Sr Cat Managers reporting to heads
    sr_managers = []
    for i in range(8):
        eid = f"EMP{len(rows)+1:05d}"
        sr_managers.append(eid)
        rows.append({
            "Employee_ID": eid, "Employee_Name": f"Sr Mgr {i+1}",
            "Role_Title": random.choice(roles_by_grade["L7"]),
            "Role_Grade": "L7", "Reports_To": random.choice(heads),
            "Function": "Procurement", "Sub_Function": random.choice(sub_functions),
            "Plant": random.choice(plants + ["HQ", "HQ"]),
            "Hire_Date": _format_date(date(2019 + i % 3, random.randint(1, 12), 1)),
            "CTC_INR_Lakhs": random.randint(60, 90), "Employment_Type": "Permanent", "Status": "Active",
            "Skill_Specialisation": random.choice(["Steel", "Coal", "Spares", "Services", "Logistics"]),
        })
    # Category Managers reporting to Sr managers
    cat_managers = []
    for i in range(15):
        eid = f"EMP{len(rows)+1:05d}"
        cat_managers.append(eid)
        rows.append({
            "Employee_ID": eid, "Employee_Name": f"CM {i+1}",
            "Role_Title": "Category Manager", "Role_Grade": "L6",
            "Reports_To": random.choice(sr_managers),
            "Function": "Procurement", "Sub_Function": random.choice(sub_functions),
            "Plant": random.choice(plants + ["HQ"]),
            "Hire_Date": _format_date(date(2020, random.randint(1, 12), 1)),
            "CTC_INR_Lakhs": random.randint(35, 55), "Employment_Type": "Permanent", "Status": "Active",
            "Skill_Specialisation": random.choice(["MRO", "Capex", "Services", "Logistics", "Spares"]),
        })
    # Remaining buyers / analysts
    while len(rows) < n:
        eid = f"EMP{len(rows)+1:05d}"
        grade = random.choices(["L5", "L4", "L3", "L2"], weights=[0.15, 0.35, 0.30, 0.20], k=1)[0]
        rows.append({
            "Employee_ID": eid, "Employee_Name": f"Buyer {len(rows)}",
            "Role_Title": random.choice(roles_by_grade[grade]), "Role_Grade": grade,
            "Reports_To": random.choice(cat_managers),
            "Function": "Procurement", "Sub_Function": random.choice(sub_functions),
            "Plant": random.choice(plants),
            "Hire_Date": _format_date(date(random.randint(2018, 2024), random.randint(1, 12), 1)),
            "CTC_INR_Lakhs": random.randint(8, 30),
            "Employment_Type": random.choices(["Permanent", "Contract"], weights=[0.85, 0.15], k=1)[0],
            "Status": random.choices(["Active", "On-leave", "Resigned"], weights=[0.92, 0.05, 0.03], k=1)[0],
            "Skill_Specialisation": random.choice(["MRO", "Capex", "Services", "Logistics", "Spares", "Commodities"]),
        })
    return pd.DataFrame(rows)


# ============================================================================
# Contract Master
# ============================================================================

def gen_contract_master(universe: dict, n: int = 45) -> pd.DataFrame:
    types = ["MK", "WK", "LP"]
    type_weights = [0.4, 0.4, 0.2]
    statuses = ["Active", "Active", "Active", "Expired", "On Hold"]
    incoterms = ["FOB", "CIF", "DDP", "EXW", "FCA"]

    # Pick vendors that have spend
    po = universe["po"]
    top_vendors = po.groupby(["Vendor_Number", "Vendor_Name"])["Net_Value"].sum() \
                    .sort_values(ascending=False).head(40)
    mg_universe = universe["mgs"]
    rows = []
    for i in range(n):
        v_idx = i % len(top_vendors)
        (vid, vname), _ = list(top_vendors.items())[v_idx][0:1][0], top_vendors.iloc[v_idx]
        # The above tuple destructuring is awkward; rewrite:
        vid, vname = top_vendors.index[v_idx]
        spend = float(top_vendors.iloc[v_idx])
        mg, mg_desc = random.choice(mg_universe)
        ctype = random.choices(types, weights=type_weights, k=1)[0]
        start = universe["date_min"] - timedelta(days=random.randint(30, 730))
        duration_days = random.choice([365, 365, 730, 1095, 180])
        end = start + timedelta(days=duration_days)
        target_value = round(spend * random.uniform(1.1, 2.5), 2)
        released = round(target_value * random.uniform(0.2, 0.95), 2)
        rows.append({
            "Contract_Number": f"45{i+1:08d}",
            "Contract_Type": ctype,
            "Vendor_Number": vid,
            "Vendor_Name": vname,
            "Material_Group": mg,
            "Material_Number": "",
            "Plant": random.choice(universe["plants"] + [""]),
            "Contract_Start_Date": _format_date(start),
            "Contract_End_Date": _format_date(end),
            "Target_Value": target_value,
            "Released_Value": released,
            "Currency": "INR",
            "Payment_Terms": random.choice(["NET 30", "NET 45", "NET 60"]),
            "Status": random.choice(statuses),
            "Incoterms": random.choice(incoterms),
        })
    return pd.DataFrame(rows)


# ============================================================================
# GRN — sampled subset of POs
# ============================================================================

def gen_grn(universe: dict, fraction: float = 0.85) -> pd.DataFrame:
    po = universe["po"].copy()
    po = po.dropna(subset=["PO_Number"])
    sample = po.sample(frac=fraction, random_state=42)
    rows = []
    for i, (_, p) in enumerate(sample.iterrows()):
        po_date = _parse_date(p["PO_Creation_Date"]) if pd.notna(p["PO_Creation_Date"]) else date.today()
        # Posting date: PO date + 5..60 days
        post_date = po_date + timedelta(days=random.randint(5, 60))
        movement = random.choices(["101", "101", "101", "101", "102"], k=1)[0]  # mostly receipts
        qty = float(p.get("Quantity") or random.randint(1, 100))
        amt = float(p.get("Net_Value") or 0) * random.uniform(0.85, 1.05)
        qi = random.choices(["Released", "Released", "Released", "Pending", "Rejected"], k=1)[0]
        rejected = int(qty * random.uniform(0.02, 0.15)) if qi == "Rejected" else 0
        rows.append({
            "GRN_Number": f"50{i+1:08d}",
            "GRN_Item": p["PO_Item"],
            "PO_Number": p["PO_Number"],
            "PO_Item": p["PO_Item"],
            "Posting_Date": _format_date(post_date),
            "Document_Date": _format_date(post_date),
            "Movement_Type": movement,
            "Quantity": qty,
            "Amount": round(amt, 2),
            "Vendor_Number": p.get("Vendor_Number"),
            "Plant": p.get("Plant"),
            "Storage_Location": random.choice(["RM01", "RM02", "SP01", "SP02", "FG01"]),
            "QI_Status": qi,
            "Rejected_Qty": rejected,
            "Created_By": f"USER{random.randint(1, 25):03d}",
        })
    return pd.DataFrame(rows)


# ============================================================================
# Invoice — sampled subset of POs
# ============================================================================

def gen_invoice(universe: dict, fraction: float = 0.78) -> pd.DataFrame:
    po = universe["po"].copy()
    po = po.dropna(subset=["PO_Number"])
    sample = po.sample(frac=fraction, random_state=24)
    rows = []
    for i, (_, p) in enumerate(sample.iterrows()):
        po_date = _parse_date(p["PO_Creation_Date"]) if pd.notna(p["PO_Creation_Date"]) else date.today()
        inv_date = po_date + timedelta(days=random.randint(7, 45))
        # Posting often delayed by 1..10 days
        post_date = inv_date + timedelta(days=random.randint(1, 10))
        terms = random.choice([30, 45, 60, 90])
        due = inv_date + timedelta(days=terms)
        paid = random.random() > 0.18
        pay_date = due + timedelta(days=random.randint(-5, 25)) if paid else None
        gross = float(p.get("Net_Value") or 0) * random.uniform(1.05, 1.18)  # tax inclusive
        tax = gross - float(p.get("Net_Value") or 0)
        status = "Paid" if paid else random.choice(["Posted", "Posted", "Pending"])
        rows.append({
            "Invoice_Number": f"51{i+1:09d}",
            "PO_Number": p["PO_Number"],
            "PO_Item": p["PO_Item"],
            "Vendor_Number": p.get("Vendor_Number"),
            "Vendor_Name": p.get("Vendor_Name"),
            "Invoice_Date": _format_date(inv_date),
            "Posting_Date": _format_date(post_date),
            "Due_Date": _format_date(due),
            "Payment_Date": _format_date(pay_date) if pay_date else "",
            "Gross_Amount": round(gross, 2),
            "Tax_Amount": round(tax, 2),
            "Currency": "INR",
            "Payment_Terms": f"NET {terms}",
            "Payment_Block": "" if random.random() > 0.06 else random.choice(["A", "P", "R"]),
            "MSME": "Yes" if random.random() < 0.18 else "No",
            "Invoice_Status": status,
        })
    return pd.DataFrame(rows)


# ============================================================================
# Main
# ============================================================================

def _augment_po_with_approver_and_emergency():
    """Add PO_Approver_Designation + PO_Approver_ID columns to the PO seed
    if missing, scaled to PO value. Also sprinkle ~2.5% of Short_Text rows
    with emergency prefixes to exercise Gold enrichment paths."""
    po_path = SEED_DIR / "demo_po_dump.csv"
    df = pd.read_csv(po_path, low_memory=False)
    changed = False

    if "PO_Approver_Designation" not in df.columns:
        T5 = ["CPO", "Chief Procurement Officer", "Head Procurement", "CFO", "Chairman"]
        T4 = ["GM", "DGM", "VP - Procurement", "VP Procurement", "GM Procurement", "Director - Procurement"]
        T3 = ["AGM", "AGM Procurement", "Sr Manager", "Sr. Manager", "Senior Manager", "Senior Manager Procurement", "Chief Manager"]
        T2 = ["Manager", "Manager Procurement", "Mgr", "Asst Manager", "Assistant Manager", "Manager - Sourcing"]
        T1 = ["Officer", "Procurement Officer", "Procurement Executive", "Sourcing Executive", "Buyer", "Sr. Buyer", "Asst Buyer", "Specialist"]
        def pick(v):
            if v >= 5_00_00_000: return random.choices([random.choice(T5), random.choice(T4)], weights=[0.6, 0.4])[0]
            if v >= 50_00_000:    return random.choices([random.choice(T4), random.choice(T3)], weights=[0.45, 0.55])[0]
            if v >= 5_00_000:     return random.choices([random.choice(T3), random.choice(T2)], weights=[0.4, 0.6])[0]
            if v >= 50_000:       return random.choices([random.choice(T2), random.choice(T1)], weights=[0.5, 0.5])[0]
            return random.choice(T1)
        random.seed(42)
        nv = pd.to_numeric(df["Net_Value"], errors="coerce").fillna(0)
        df["PO_Approver_Designation"] = [pick(v) for v in nv]
        df["PO_Approver_ID"] = [f"EMP-{random.randint(1000, 9999)}" for _ in range(len(df))]
        changed = True
        print(f"  augmented PO with approver columns ({len(df)} rows)")

    if "Short_Text" in df.columns:
        # Check if any emergency keywords already present
        existing = df["Short_Text"].astype(str).str.lower().str.contains(
            r"emergency|urgent|breakdown|rush order", na=False, regex=True
        ).sum()
        if existing < int(len(df) * 0.01):
            prefixes = ["EMERGENCY -", "URGENT:", "BREAKDOWN -", "RUSH ORDER:", "CRITICAL BREAKDOWN -"]
            random.seed(123)
            target = int(len(df) * 0.025)
            idx = random.sample(range(len(df)), target)
            st = df["Short_Text"].astype(str).copy()
            for i in idx:
                cur = str(st.iloc[i] or "").strip()
                p = random.choice(prefixes)
                st.iloc[i] = f"{p} {cur}" if cur and cur != "nan" else p
            df["Short_Text"] = st
            changed = True
            print(f"  tagged {target} Short_Text rows with emergency keywords")

    if changed:
        df.to_csv(po_path, index=False)
        print(f"  → wrote {po_path}")


def main():
    _augment_po_with_approver_and_emergency()
    universe = load_po_universe()
    print(f"PO universe: {len(universe['vendors'])} vendors, "
          f"{len(universe['plants'])} plants, {len(universe['mgs'])} MGs, "
          f"dates {universe['date_min'].date()} → {universe['date_max'].date()}")

    out = {
        "demo_vendor_master.csv": gen_vendor_master(universe),
        "demo_material_master.csv": gen_material_master(universe),
        "demo_org_structure.csv": gen_org_structure(universe, n=80),
        "demo_contract_master.csv": gen_contract_master(universe, n=45),
        "demo_grn.csv": gen_grn(universe, fraction=0.85),
        "demo_invoice.csv": gen_invoice(universe, fraction=0.78),
    }
    for name, df in out.items():
        path = SEED_DIR / name
        df.to_csv(path, index=False)
        print(f"  {name}: {len(df):>6} rows · {len(df.columns):>2} columns → {path}")


if __name__ == "__main__":
    main()
