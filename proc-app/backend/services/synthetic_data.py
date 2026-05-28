"""Synthetic PO dataset generator — realistic Indian steel mill shape.

Produces ~5,000 rows across:
  - 50 material groups spanning all 5 archetypes (BULK / DIRECT / INDIRECT / SERVICE / CAPEX)
  - 6 plants (3 integrated mills + 2 mini-plants + 1 specialty unit)
  - ~55 vendors
  - 18 months of POs
  - Realistic SAP-style column names (deliberately client-raw, not canonical)

The data is engineered so that the Op Model engine will fire interestingly:
  - Multi-plant BULK + INDIRECT categories with same-vendor overlap (Centralisation)
  - High-volume low-value INDIRECT MGs (Shared Services)
  - Strategic DIRECT MGs with vendor concentration (CoE)
  - Long-tail low-value misc MGs (Tail Spend)

Usage:
    from backend.services import synthetic_data
    df = synthetic_data.generate_steel_po_dump(seed=42)
    df.to_csv("po_dump.csv", index=False)
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from typing import Optional

import pandas as pd


# --------------------------------------------------------------------------
# Master data
# --------------------------------------------------------------------------

PLANTS = [
    ("JSR", "Jamshedpur"),          # integrated mill
    ("KLN", "Kalinganagar"),        # integrated mill
    ("ANG", "Angul"),                # integrated mill
    ("BPS", "Bhilai"),               # mini-plant
    ("DOL", "Dolvi"),                # mini-plant
    ("VSP", "Visakhapatnam"),        # specialty unit
]

# (mg_code, mg_desc, archetype, base_value_inr, vendor_count, plants_buying, frequency_per_month, pac_pct, short_text_template)
# archetype drives downstream classification; vendor_count + plants_buying drive multi-plant patterns
MATERIAL_GROUPS = [
    # ----- BULK raw materials (low MG count, high spend, contracted) -----
    ("1010001", "COAL THERMAL GRADE A 5K", "BULK", 2200000, 4, 5, 8, 0, ""),
    ("1010002", "COKING COAL IMPORTED AUS PREMIUM", "BULK", 1800000, 3, 4, 10, 0, ""),
    ("1010003", "IRON ORE LUMPS MARKET", "BULK", 1500000, 4, 5, 12, 0, ""),
    ("1010004", "IRON ORE FINES OPEN MARKET", "BULK", 1200000, 4, 5, 14, 0, ""),
    ("1010005", "LIMESTONE LUMPS BLAST FURNACE", "BULK", 350000, 3, 4, 8, 0, ""),
    ("1010006", "DOLOMITE LUMPS", "BULK", 280000, 2, 3, 6, 0, ""),
    ("1010007", "QUARTZITE BLAST FURNACE", "BULK", 220000, 2, 3, 5, 0, ""),
    ("1010008", "PELLET FEED IRON ORE", "BULK", 1100000, 3, 4, 9, 0, ""),
    ("1010009", "SCRAP HEAVY MELT", "BULK", 950000, 8, 3, 10, 0, ""),
    ("1010010", "FERRO MANGANESE Mn78", "BULK", 600000, 4, 4, 6, 0, ""),
    ("1010011", "SILICO MANGANESE SiMn70", "BULK", 500000, 4, 4, 6, 0, ""),
    ("1010012", "FERRO SILICON FeSi75", "BULK", 380000, 3, 3, 5, 0, ""),
    ("1010013", "FERRO CHROME HIGH CARBON", "BULK", 700000, 3, 2, 4, 0, ""),
    ("1010014", "OXYGEN GAS LIQUID", "BULK", 450000, 1, 3, 8, 30, "PROPRIETARY ASU CONTRACT LINDE"),
    ("1010015", "NITROGEN GAS LIQUID", "BULK", 280000, 1, 3, 8, 30, "PROPRIETARY ASU CONTRACT LINDE"),
    # ----- DIRECT process inputs (spec-sensitive, vendor-concentrated) -----
    ("2020101", "REFRACTORY BRICK MAG-C", "DIRECT", 800000, 3, 4, 4, 0, ""),
    ("2020102", "REFRACTORY CASTABLE HIGH ALUMINA", "DIRECT", 550000, 3, 4, 5, 0, ""),
    ("2020103", "REFRACTORY MORTAR", "DIRECT", 180000, 2, 3, 3, 0, ""),
    ("2020104", "SLIDE GATE PLATE", "DIRECT", 2200000, 2, 4, 2, 30, "OEM SPEC RHI MAGNESITA"),
    ("2020105", "SUBMERGED ENTRY NOZZLE", "DIRECT", 1500000, 2, 3, 2, 40, "PROPRIETARY VESUVIUS DESIGN"),
    ("2020106", "TUNDISH BOARD", "DIRECT", 380000, 2, 4, 3, 0, ""),
    ("2020107", "MOULD FLUX POWDER", "DIRECT", 650000, 1, 4, 3, 70, "SOLE SOURCE PROPRIETARY FORMULA"),
    ("2020108", "LANCE PIPE BOF", "DIRECT", 280000, 2, 3, 4, 0, ""),
    ("2020109", "GRAPHITE ELECTRODE 600MM", "DIRECT", 3500000, 3, 2, 2, 0, ""),
    ("2020110", "WORK ROLL FORGED", "DIRECT", 7500000, 2, 4, 1, 50, "PAC OEM SHEFFIELD FORGEMASTERS"),
    ("2020111", "BACKUP ROLL FORGED", "DIRECT", 6500000, 2, 3, 1, 50, "PAC OEM KOBE STEEL"),
    ("2020112", "INTERMEDIATE ROLL", "DIRECT", 4500000, 2, 3, 1, 0, ""),
    ("2020113", "MILL ROLL CHOCK ASSEMBLY", "DIRECT", 1200000, 3, 3, 2, 0, ""),
    # ----- INDIRECT MRO + consumables (high PO count, low value, fragmented vendors) -----
    ("3030201", "BEARING MECHANICAL SPARE SKF", "INDIRECT", 18000, 12, 6, 24, 0, ""),
    ("3030202", "BEARING MECHANICAL SPARE TIMKEN", "INDIRECT", 22000, 8, 5, 20, 0, ""),
    ("3030203", "HYDRAULIC HOSE INDUSTRIAL", "INDIRECT", 8500, 14, 6, 26, 0, ""),
    ("3030204", "HYDRAULIC OIL ISO 68", "INDIRECT", 12000, 6, 6, 18, 0, ""),
    ("3030205", "GREASE INDUSTRIAL EP2", "INDIRECT", 6500, 8, 6, 22, 0, ""),
    ("3030206", "LUBRICATION OIL TURBINE", "INDIRECT", 32000, 5, 5, 12, 0, ""),
    ("3030207", "INDUCTION MOTOR 30KW SPARE", "INDIRECT", 65000, 9, 5, 8, 0, ""),
    ("3030208", "VALVE PNEUMATIC ACTUATOR", "INDIRECT", 28000, 11, 6, 14, 0, ""),
    ("3030209", "CONVEYOR BELT INDUSTRIAL", "INDIRECT", 180000, 6, 5, 6, 0, ""),
    ("3030210", "PUMP CENTRIFUGAL 5HP", "INDIRECT", 45000, 12, 6, 10, 0, ""),
    ("3030211", "PPE HELMET SAFETY", "INDIRECT", 1200, 15, 6, 30, 0, ""),
    ("3030212", "PPE SAFETY BOOTS", "INDIRECT", 2800, 10, 6, 24, 0, ""),
    ("3030213", "STATIONERY OFFICE SUPPLIES", "INDIRECT", 800, 18, 6, 32, 0, ""),
    ("3030214", "TONER CARTRIDGE LASER", "INDIRECT", 4500, 7, 6, 16, 0, ""),
    ("3030215", "WELDING ELECTRODE E7018", "INDIRECT", 3200, 9, 6, 22, 0, ""),
    ("3030216", "INSTRUMENTATION SENSOR PRESSURE", "INDIRECT", 38000, 8, 5, 12, 0, ""),
    # ----- SERVICE (recurring + project) -----
    ("4040301", "CONTRACT LABOUR PLANT MAINTENANCE", "SERVICE", 450000, 6, 6, 12, 0, ""),
    ("4040302", "HOUSEKEEPING SERVICES MONTHLY", "SERVICE", 180000, 4, 6, 12, 0, ""),
    ("4040303", "ANNUAL MAINTENANCE CONTRACT CRANE", "SERVICE", 850000, 3, 5, 4, 0, ""),
    ("4040304", "TRANSPORT INPLANT", "SERVICE", 280000, 6, 6, 14, 0, ""),
    ("4040305", "REFRACTORY RELINING SERVICE", "SERVICE", 5500000, 2, 3, 2, 30, "OEM CERTIFIED RELINING CONTRACTOR"),
    ("4040306", "CIVIL CONSTRUCTION PROJECT WORK", "SERVICE", 12000000, 4, 3, 1, 0, ""),
    ("4040307", "CONSULTANCY ENGINEERING DESIGN", "SERVICE", 850000, 3, 2, 2, 0, ""),
    ("4040308", "SECURITY CONTRACT PLANT", "SERVICE", 220000, 4, 6, 12, 0, ""),
    # ----- CAPEX (rare, high value) -----
    ("5050401", "CRANE EOT 50T NEW INSTALLATION", "CAPEX", 18000000, 2, 1, 1, 0, ""),
    ("5050402", "POWER PLANT TURBINE COMPONENT", "CAPEX", 55000000, 1, 1, 1, 100, "PAC OEM SIEMENS"),
    ("5050403", "ROLLING MILL EQUIPMENT UPGRADE", "CAPEX", 35000000, 2, 1, 1, 0, ""),
    ("5050404", "DRI PLANT EQUIPMENT KILN COMPONENT", "CAPEX", 22000000, 2, 1, 1, 50, "PAC LICENSED TECHNOLOGY MIDREX"),
]


# Vendor pool — some named, mix of common Indian + global vendors
VENDORS = [
    ("V0001", "Tata Steel Mining Ltd"),
    ("V0002", "NMDC Limited"),
    ("V0003", "Coal India Limited"),
    ("V0004", "BHP Mitsubishi Alliance"),
    ("V0005", "Adani Enterprises"),
    ("V0006", "JSPL Sourcing"),
    ("V0007", "Linde India Ltd"),
    ("V0008", "Air Liquide India"),
    ("V0009", "RHI Magnesita India"),
    ("V0010", "Vesuvius India Ltd"),
    ("V0011", "Calderys India Refractories"),
    ("V0012", "IFGL Refractories Ltd"),
    ("V0013", "HEG Limited"),
    ("V0014", "Showa Denko Carbon"),
    ("V0015", "Kobe Steel International"),
    ("V0016", "Sheffield Forgemasters"),
    ("V0017", "Union Electric Akers"),
    ("V0018", "SKF India Ltd"),
    ("V0019", "Timken India Ltd"),
    ("V0020", "NTN Bearings India"),
    ("V0021", "Schaeffler India"),
    ("V0022", "Shell India Lubricants"),
    ("V0023", "Castrol India Ltd"),
    ("V0024", "Indian Oil Corporation"),
    ("V0025", "Gulf Oil Lubricants"),
    ("V0026", "ABB India Ltd"),
    ("V0027", "Siemens India Ltd"),
    ("V0028", "Crompton Greaves"),
    ("V0029", "Larsen and Toubro"),
    ("V0030", "BHEL Engineering"),
    ("V0031", "Voltas Industrial"),
    ("V0032", "Bosch India"),
    ("V0033", "Mahindra Logistics"),
    ("V0034", "BlueDart Logistics"),
    ("V0035", "TVS Logistics"),
    ("V0036", "Sundaram Industries"),
    ("V0037", "3M India Industrial"),
    ("V0038", "Honeywell Automation"),
    ("V0039", "Yokogawa India"),
    ("V0040", "Emerson Process"),
    ("V0041", "Manpower Services India"),
    ("V0042", "ISS Facility Services"),
    ("V0043", "Sodexo India"),
    ("V0044", "G4S Security"),
    ("V0045", "SIS Security Services"),
    ("V0046", "Local Vendor Cluster A"),
    ("V0047", "Local Vendor Cluster B"),
    ("V0048", "Local Vendor Cluster C"),
    ("V0049", "Local Vendor Cluster D"),
    ("V0050", "Local Vendor Cluster E"),
    ("V0051", "MOIL Limited"),
    ("V0052", "Ferro Alloys Corp India"),
    ("V0053", "Hindustan Zinc Ltd"),
    ("V0054", "Vedanta Aluminium"),
    ("V0055", "Sterlite Power"),
]


PURCHASE_GROUPS = ["P01-CENTRAL", "P02-CENTRAL", "P10-JSR", "P11-JSR", "P20-KLN", "P30-ANG", "P40-BPS", "P50-DOL", "P60-VSP"]

# SAP-style item categories / material types per archetype
ARCHETYPE_TO_SAP = {
    "BULK":    {"item_cat": "",  "mat_type": "ROH"},
    "DIRECT":  {"item_cat": "",  "mat_type": "ROH"},
    "INDIRECT":{"item_cat": "",  "mat_type": "ERSA"},
    "SERVICE": {"item_cat": "D", "mat_type": "DIEN"},
    "CAPEX":   {"item_cat": "A", "mat_type": "ANLZ"},
}

# Probability of contract reference field populated per archetype
ARCHETYPE_CONTRACT_PROB = {
    "BULK":     {"contract": 0.72, "ola": 0.18, "scheduling": 0.05},
    "DIRECT":   {"contract": 0.25, "ola": 0.20, "scheduling": 0.02},
    "INDIRECT": {"contract": 0.05, "ola": 0.15, "scheduling": 0.05},
    "SERVICE":  {"contract": 0.10, "ola": 0.30, "scheduling": 0.00},
    "CAPEX":    {"contract": 0.00, "ola": 0.00, "scheduling": 0.00},
}


# --------------------------------------------------------------------------
# Generator
# --------------------------------------------------------------------------

def generate_steel_po_dump(seed: int = 42, months: int = 18) -> pd.DataFrame:
    """Generate a PO dump dataframe with raw SAP-style column names.

    Columns are deliberately client-raw (e.g., "Pur.Order Number") so the
    column-mapping step has something realistic to do.
    """
    rng = random.Random(seed)
    end_date = date(2025, 12, 31)
    start_date = end_date - timedelta(days=months * 30)

    rows = []
    po_counter = 1000

    for mg_code, mg_desc, archetype, base_val, vendor_n, plants_n, freq_per_month, pac_pct, short_text in MATERIAL_GROUPS:
        # Pick which vendors serve this MG
        mg_vendors = rng.sample(VENDORS, k=vendor_n)
        # Pick which plants buy this MG
        mg_plants = rng.sample(PLANTS, k=plants_n)
        # Top vendor share — for some MGs, top vendor commands a large share (concentration signal)
        if vendor_n <= 2 or pac_pct >= 50:
            top_share = rng.uniform(0.85, 1.0)
        elif vendor_n <= 4:
            top_share = rng.uniform(0.55, 0.78)
        else:
            top_share = rng.uniform(0.25, 0.50)
        vendor_weights = _weighted_distribution(vendor_n, top_share)
        vendor_pool = list(zip(mg_vendors, vendor_weights))

        total_pos = int(freq_per_month * months)
        for _ in range(total_pos):
            po_counter += 1
            po_num = f"45{po_counter:07d}"

            # Vendor pick — weighted
            vendor = _weighted_pick(rng, vendor_pool)
            # Plant pick (uniform across mg_plants)
            plant = rng.choice(mg_plants)
            # Purchase group — Central for BULK + DIRECT + CAPEX, plant-specific for INDIRECT + SERVICE
            if archetype in ("BULK", "DIRECT", "CAPEX"):
                pgroup = rng.choice(["P01-CENTRAL", "P02-CENTRAL"])
            else:
                pgroup_map = {"JSR": ["P10-JSR", "P11-JSR"], "KLN": ["P20-KLN"], "ANG": ["P30-ANG"],
                              "BPS": ["P40-BPS"], "DOL": ["P50-DOL"], "VSP": ["P60-VSP"]}
                pgroup = rng.choice(pgroup_map.get(plant[0], ["P01-CENTRAL"]))

            # Date — spread across the period
            day_offset = rng.randint(0, months * 30)
            po_date = start_date + timedelta(days=day_offset)

            # Value — log-normal around base value with multiplier
            value_mult = rng.lognormvariate(0, 0.4)
            net_value = round(base_val * value_mult, 2)

            # Item category / material type
            sap = ARCHETYPE_TO_SAP[archetype]

            # Currency — INR default; ~5% of BULK + CAPEX in USD (imports)
            currency = "INR"
            if archetype in ("BULK", "CAPEX") and rng.random() < 0.05:
                currency = "USD"
                net_value = round(net_value / 83.0, 2)   # rough USD-INR

            # Contract fields per archetype probability
            probs = ARCHETYPE_CONTRACT_PROB[archetype]
            contract_num = ""
            ola_num = ""
            sched_num = ""
            r = rng.random()
            if r < probs["contract"]:
                contract_num = f"46{rng.randint(10000, 99999)}"
            elif r < probs["contract"] + probs["ola"]:
                ola_num = f"55{rng.randint(10000, 99999)}"
            elif r < probs["contract"] + probs["ola"] + probs["scheduling"]:
                sched_num = f"45SA{rng.randint(10000, 99999)}"

            # PAC indicator in short text
            line_short_text = short_text
            if not line_short_text and rng.random() < pac_pct / 100.0:
                line_short_text = "PAC PROPRIETARY OEM SPEC"

            # Quantity (rough)
            qty = max(1, int(rng.lognormvariate(2, 0.8)))
            uom = "NOS" if archetype in ("INDIRECT", "CAPEX") else "MT" if archetype == "BULK" else "EA"

            rows.append({
                "Pur.Order Number": po_num,
                "Item": rng.randint(10, 90) // 10 * 10,
                "PO Doc. Date": po_date.strftime("%d-%m-%Y"),
                "Mat.Group": mg_code,
                "Mat.Group.1": mg_desc,
                "Net Value": net_value,
                "Curr": currency,
                "Vendor": vendor[0],
                "Vendor Name": vendor[1],
                "Plant": plant[0],
                "Plant Name": plant[1],
                "Purch. Group": pgroup,
                "Cost Center": f"CC{rng.randint(1000, 9999)}",
                "Short Text": line_short_text,
                "Agreement Number": contract_num,
                "Outline Agreement": ola_num,
                "Scheduling Agreement": sched_num,
                "Pstyp": sap["item_cat"],
                "Material Type": sap["mat_type"],
                "Quantity": qty,
                "UoM": uom,
            })

    df = pd.DataFrame(rows)
    # Shuffle so dates are interleaved (more realistic)
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    return df


def _weighted_distribution(n: int, top_share: float) -> list[float]:
    """Return n weights summing to 1 where the first weight = top_share."""
    if n == 1:
        return [1.0]
    remaining = 1.0 - top_share
    rest = [remaining / (n - 1)] * (n - 1)
    return [top_share] + rest


def _weighted_pick(rng: random.Random, pool: list) -> tuple:
    """Weighted sample from [(item, weight), ...]."""
    r = rng.random()
    cum = 0.0
    for item, w in pool:
        cum += w
        if r < cum:
            return item
    return pool[-1][0]


# --------------------------------------------------------------------------
# CLI entry for manual generation
# --------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    out_path = sys.argv[1] if len(sys.argv) > 1 else "po_dump_demo.csv"
    df = generate_steel_po_dump(seed=42)
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")
    print(f"Columns ({len(df.columns)}): {list(df.columns)}")
    print(f"Total spend (INR): {df['Net Value'].sum():,.0f}")
    print(f"Plants: {df['Plant'].nunique()}, Vendors: {df['Vendor'].nunique()}, MGs: {df['Mat.Group'].nunique()}")
