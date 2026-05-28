# KPI Calculation Rules — Procurement Function

**Layer:** function-level. Cross-pillar methodology.
**Companion:** `_meta/kpi-calculation-rules.yml` (machine-readable thresholds + lists).
**Distinct from:** `_meta/cleansing-rules.yml` (row/column cleansing) and per-pillar `analysis-config.yml` (pillar-specific filters). This file is the **KPI math**.

---

## TAT (PR-to-PO Turnaround Time)

### Rule 1 — Count each PO only once (deduplication)

Group by **PO Number**. Take `min(PO_Creation_Date)` and `min(PR_Release_Date)` per unique PO. This prevents line-item over-weighting where a multi-line PO would otherwise count the same PO N times.

### Rule 2 — Outlier removal: IQR upper fence (Tukey)

1. Remove rows where `TAT ≤ 0` (negatives and zeros — data errors).
2. Compute Q1, Q3 of remaining positive values.
3. **Upper fence** = `Q3 + 1.5 × IQR`.
4. Remove **only rows above the fence** — fast TATs are genuine performance, not errors.
5. Minimum **10 rows required** after trimming; else skip trim and use all remaining.
6. **Do NOT use P5–P95 percentile trim** (prior method — replaced).

### Rule 3 — Date column priority

1. `PR_Release_Date` + `PO_Creation_Date` within the PO dump itself (same file).
2. Join PO dump + separate PR dump on `PR_Reference = PR_Number`.
3. Pre-computed TAT column as last resort (with warning flag to user).

### Rule 4 — Calculation note shown to user

Always show: source used, rows before/after deduplication, IQR fence value, rows excluded, rows used for final mean.

---

## Savings over LPO

### Method (current): Monthly average price comparison

1. Group PO lines by calendar month.
2. Compute **average unit price per month**.
3. `Savings% = (prior_month_avg_price − latest_month_avg_price) / prior_month_avg_price`.
4. Requires **minimum 2 months** of data.
5. Returns fraction 0–1 (multiply by 100 for display).

### LPO derivation priority

1. `LPO_Price` column if present in PO dump.
2. Most recent **prior purchase of the same material within 2 years** (derived from PO history).
3. Unit: `Net_Price` or `Net_Price_Per_Unit` column.

---

## RC Adoption

### Exclusion list (treated as "no contract")

Case-insensitive: `non arc`, `non-arc`, `no`, `none`, `n/a`, `na`, `0`, `no contract`, `spot`, `open po`, `non-rc`, `nonrc`, `non rc`.

### Method 1 — Agreement column present

Count rows where agreement column is **not null, not blank, and not in the exclusion list** above.

### Method 2 — PO Type column, no agreement column

Use SAP PO Type codes:

- **RC types:** `LP`, `LPA`, `WK`, `MK`, `KA`, `framework`, `RC`, `blanket`
- **Spot types:** `NB` and anything else

---

## Tail Spend

- **Threshold:** Fixed at **₹1,00,000 (₹1 Lakh) per PO line** — not configurable.
- **Unit detection:**
  1. If column name contains `cr` or `crore` → values are in Crore → multiply by `1e7` first.
  2. Else if **median of positive values < 10** → assume Crore → multiply by `1e7`.
  3. Else → assume raw INR.
- **Metric:** % of PO lines (not spend value) below the threshold.

---

## OTD (On-Time Delivery)

- **Denominator:** Only POs that have a GR Date (delivered POs). Undelivered / open POs excluded entirely.
- **No grace period:** `GR_Date ≤ Delivery_Date` exactly. Not `≤ + 1 day`, not `≤ + 3 days`.
- **Full delivery required:** If `GR Quantity < PO Quantity`, the PO is NOT counted as on-time even if the GR date was on time. Partial delivery = not on-time.

---

## Spend Unit Detection (`_to_cr`)

Used in KPI dashboard for all spend values.

```python
total = sum_of_all_values_in_column
if total >= 1e7:   # raw INR
    cr = total / 1e7
elif total >= 1e5: # thousands
    cr = total / 1e5
else:              # already Crore
    cr = total
```

**Why sum-based, not median or max:**

- Median fails when many small line items drag it below ₹1 lakh even though total is ₹400 Cr+.
- Max fails when no single line exceeds ₹1 Cr even though total is clearly hundreds of Crore.
- **Sum is the only reliable signal at portfolio scale.**

**Indian number format:** Strip commas from strings before converting (`"1,23,456"` → `123456`). These coerce to NaN with `pd.to_numeric` and silently zero out the entire spend column.

---

## PAC Detection

### From PO dump — binary flag column (priority order)

`pac_flag`, `pac_pr`, `pac`, `single_source_flag`, `PAC_Flag`, `PAC`

### From text

Scan `Short_Text`, `PR_Text`, `Remarks`, `Reason` for `"PAC"` (uppercase).

### Yes values accepted

`yes`, `y`, `true`, `1`, `pac`, `single source`, `sole source`

### Denominator

Unique PO numbers (not lines) — a PO is counted as PAC if any of its lines has the flag set.

---

## Column Mapping & Alias Resolution (3-level fallback)

For every column lookup, the app tries **in order**:

1. `col_map` override (from Column Review page — user-confirmed mapping).
2. Exact column name match (case-sensitive).
3. Case-insensitive match.
4. Underscore ↔ space normalised match (`Net_Value` matches `Net Value`).
5. JSW / non-standard alias list (e.g., `Pur.Order Number`, `PO Doc Date`, `Vendo Name`).
6. **Never fail silently** — if a required column is not found, the KPI is marked `available: False` and shown as `—` in the UI rather than computing with wrong data.

---

## Outlier Removal — General Principle

**Only apply the upper fence (Tukey).** Never remove fast / good performance values — those are real. Only remove the extreme slow / bad tail which is almost always a data quality issue (e.g., PRs from 3 years ago matched to current POs, giving 800-day TAT).
