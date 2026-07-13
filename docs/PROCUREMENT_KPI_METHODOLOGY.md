# Procurement KPI Methodology — PO + PR Dumps

> **Tool-independent methodology document.** Complete specification for computing procurement KPIs from a PO (Purchase Order) dump and PR (Purchase Requisition) dump. Written for a developer/analyst porting these rules to a different tool.

**Coverage:** 8 methodology KPIs
- TAT (PR-to-PO turnaround)
- Savings over LPO
- RC Adoption
- PAC / Single-Vendor
- Tail Spend
- Spend per FTE
- On-Time Delivery
- Sourcing Tool Usage

Every KPI is spelled out end-to-end: source columns → cleansing → formula → outlier handling → representation.

---

# Part 1 — Data Sources

## 1.1 PO dump — required columns

Column names are canonical; your source Excel may use different labels (see Part 2 for column mapping).

| Canonical name | SAP field | Type | Required? | Why it matters |
|---|---|---|---|---|
| `po_number` | EBELN | string | ✅ Yes | PO deduplication (multi-line POs) |
| `po_item` | EBELP | int | ✅ Yes | Line ID |
| `po_creation_date` | BEDAT | date | ✅ Yes | TAT, Savings over LPO, period slicing |
| `plant` | WERKS | string | ✅ Yes | Op Model + Org Structure analyses |
| `purchase_group` | EKGRP | string | ✅ Yes | Buyer team |
| `vendor_id` | LIFNR | string | ✅ Yes | Vendor concentration, Supplier pillar |
| `vendor_name` | LFA1.NAME1 | string | ✅ Yes | Human-readable vendor |
| `material_group` | MATKL | string | ✅ Yes | Category rollup |
| `material_group_desc` | MATKL text | string | Optional | Human-readable category |
| `material_number` | MATNR | string | Optional | Savings over LPO per-material path |
| `net_value` | NETWR | number | ✅ Yes | All spend-based KPIs |
| `currency` | WAERS | string | ✅ Yes | FX conversion |
| `net_price` | NETPR | number | Optional | Savings over LPO |
| `quantity` | MENGE | number | Optional | Partial-delivery check for OTD |
| `gr_quantity` | MSEG.MENGE | number | Optional | OTD strictness |
| `delivery_date` | EINDT | date | Optional | OTD |
| `gr_date` | MSEG.BUDAT | date | Optional | OTD |
| `pr_reference` | BANFN | string | Optional | TAT join to PR file |
| `contract_number` | KONNR | string | Optional | RC Adoption Method 1 |
| `outline_agreement` | — | string | Optional | RC Adoption Method 1 |
| `scheduling_agreement` | — | string | Optional | RC Adoption Method 1 |
| `po_type` | BSART | string | Optional | RC Adoption Method 2 fallback |
| `short_text` | TXZ01 | string | Optional | PAC text scan |
| `pac_flag` (or `pac`, `pac_pr`, `single_source_flag`) | custom | string/bool | Optional | PAC explicit flag |

### Also useful (Stage 9 classification cascade)

For richer material classification, the pipeline also reads these when present. None are required for the 8 KPIs but they improve category rollups:

| Canonical | SAP | Purpose |
|---|---|---|
| `hsn_code` | — | Tier A classification (most reliable) |
| `external_material_group` | EXTWG | Parallel classification |
| `material_long_text` | MAKT / LTXT | Richest description for keyword scan |
| `material_master_desc` | MARA.MAKTX | Master-level description |
| `old_material_number` | BISMT | Legacy code with category prefix |
| `item_category` | PSTYP | Archetype hint (A=CAPEX, D=SERVICE) |
| `material_type` | MTART | Archetype hint (ROH/DIEN/ANLZ/ERSA) |

## 1.2 PR dump — required columns

| Canonical name | SAP field | Type | Required? | Why |
|---|---|---|---|---|
| `pr_number` | BANFN | string | ✅ Yes | Join key to `po.pr_reference` |
| `pr_creation_date` | ERDAT | date | ✅ Yes | TAT start-point option A |
| `pr_release_date` | FRGDT | date | ✅ Yes (preferred) | TAT start-point option B, preferred over creation date |
| `plant` | WERKS | string | Optional | Consistency check |
| `purchase_group` | EKGRP | string | Optional | Approval routing analysis |
| `pr_total_value` | — | number | Optional | PR-estimate vs PO-actual (variance) |

**Priority for TAT clock start:** `pr_release_date` > `pr_creation_date`. `pr_release_date` represents when the PR became actionable (approved); `pr_creation_date` includes the approval delay upstream.

## 1.3 Optional supporting files

| File | KPIs it unlocks / sharpens |
|---|---|
| **GRN** (Goods Receipt) | OTD (uses posting_date, movement_type=101 for receipt / 102 excluded); Supplier Defect Rate |
| **Invoice** | 3-way match, DPO (Days Payable Outstanding) |
| **Contract Master** | RC Adoption sharpener (validates active contracts vs PO date) |
| **Vendor Master** | MSME share, HHI concentration, dormancy analysis |
| **Material Master** | Material master quality, dedup rate, code-creation TAT |
| **Employee Master / Org Structure** | Spend/FTE (replaces manual `fte_count`), span of control |

## 1.4 Engagement profile inputs (from the consultant, not from files)

| Input | Type | Used by |
|---|---|---|
| `fte_count` | int | Spend per FTE |
| `annual_spend_inr_cr` | number | Cross-check; Org Structure spend/FTE benchmark |
| `industry` | string | Benchmark overlay (steel / cement) |
| `sub_segment` | string | Cement kiln type, steel integrated vs mini-mill |
| `plants` | list | Consistency check with PO data |

## 1.5 QRE (Qualitative Response Evaluation) inputs

Only used by Sourcing Tool Usage KPI (D12.1: digital sourcing maturity, scored 0-4). Other KPIs above are data-driven.

---

# Part 2 — Column Mapping & Alias Resolution

Real-world PO/PR exports never use canonical column names — every ERP is different, every client tweaks them. Handle mapping in this order:

1. **User-confirmed override** — always wins (the consultant reviewed and set the mapping explicitly)
2. **Exact match** (case-sensitive) — e.g. `PO_Number` matches `po_number` after normalisation
3. **Case-insensitive match** — `PO Number` matches `po_number`
4. **Underscore ↔ space normalised** — `Net Value` ↔ `Net_Value` ↔ `net_value`
5. **Known alias list** — e.g. `Pur.Order Number`, `PO Doc Date`, `Vendo Name` (typos), `EBELN`
6. **LLM enrichment** (optional) — send unknown column headers + first 5 sample values + the canonical schema to an LLM, ask it to map. Especially good for odd variants like `"P/L Mat Group"`.

**Silent failure is banned.** If a required column is not found after all fallbacks, the KPI is marked `available: False` and shown as `—` in the UI, not computed with wrong data.

## Common aliases per canonical field

| Canonical | Common aliases |
|---|---|
| `po_number` | PO Number, PO_Number, Pur.Order Number, EBELN, Purchase Order Number, PO Doc Number |
| `po_creation_date` | PO Date, PO_Date, PO Doc Date, PO Creation Date, BEDAT, Doc Date |
| `pr_number` | PR Number, PR_Number, Requisition Number, BANFN |
| `pr_release_date` | PR Release Date, Approval Date, FRGDT |
| `pr_creation_date` | PR Date, Requisition Date, ERDAT |
| `net_value` | Net Value, Net Order Value, NETWR, PO Value, Amount |
| `net_price` | Net Price, Unit Price, NETPR, Rate |
| `material_group` | Material Group, Mat.Group, MATKL, MG, Category |
| `material_group_desc` | Matl Group Desc, MG Description, MATKL Text |
| `vendor_id` | Vendor Number, Vendor Code, LIFNR, Supplier Code |
| `vendor_name` | Vendor Name, Supplier Name, LFA1.NAME1 |
| `plant` | Plant, Plant Code, WERKS, Location |
| `contract_number` | Contract Number, Contract, KONNR, Agreement Number, ARC Number |
| `outline_agreement` | Outline Agreement, Framework Agreement, OLA |
| `scheduling_agreement` | Scheduling Agreement, Blanket Order |
| `delivery_date` | Delivery Date, Promised Date, Required Date, EINDT |
| `gr_date` | GR Date, GRN Date, Receipt Date, Posting Date |

---

# Part 3 — Multi-Sheet Excel Handling

Real client PO/PR dumps often arrive as one Excel workbook with one sheet per financial year (FY22, FY23, FY24).

## Rules

1. **Read every sheet** — not just the first. `pd.read_excel(file, sheet_name=None)` returns `{sheet_name: DataFrame}` dict.
2. **Vertical concat with source tag** — combine all sheets into one DataFrame, add a `_source_sheet` column tagging each row with its origin sheet name.
3. **Skip empty sheets** (0 rows) — record as excluded with reason.
4. **Skip cover pages** — heuristic: sheet has ≤ 2 columns AND the first row's non-blank cell count ≤ half the column count. Reason: `looks_like_cover_page`.
5. **Handle schema drift** — if not all sheets have the same columns (e.g. FY24 added `EXTWG` that FY22 didn't have), pandas NaN-pads missing columns automatically. Surface this as a warning: `schema_drift`.
6. **Preserve `_source_sheet` through cleansing** so downstream can groupby FY tab if needed.

## Consultant-facing panel

Before running any analysis, show:

```
Sheets loaded from JSL_PO.xlsx:
  Cover    EXCL (cover page)         1 row · 1 col
  FY22     INCL                    166 rows · 26 cols
  FY23     INCL                    166 rows · 26 cols
  FY24     INCL                    168 rows · 26 cols
Combined: 500 rows
Warnings: schema_drift (FY24 has 'External Material Group' not in FY22/FY23)
```

---

# Part 4 — Data Cleansing Pipeline

Apply in strict order on the combined DataFrame:

## 4.1 Type coercion

- **Dates:** parse from `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD` (ISO), Excel serial (integer days since 1900-01-01). Bad values → `NaT` (not-a-time), flagged not dropped.
- **Numbers:** `pd.to_numeric(errors="coerce")` — bad values become `NaN`.
- **Text:** strip whitespace, coerce `NaN` to empty string.

## 4.2 Indian number-format handling

Real Indian source data uses commas: `"1,23,456.78"`. The default numeric coerce sends these to NaN, which silently zeroes the spend column.

**Rule:** for any string column expected to hold numbers, strip commas before conversion: `s.str.replace(",", "")`. Then coerce.

## 4.3 Currency normalisation

Every row gets a parallel `net_value_inr` column.

**Priority:**
1. Currency = `INR` → `net_value_inr = net_value`
2. Currency ≠ `INR` → look up FX rate for `(currency, po_creation_date)`:
   - If a period-specific rate table is available: `net_value × rate_for_that_month`
   - Else: year-end average rate for the currency
3. Store `fx_rate_applied` on the row for audit

Default rate table (INR per unit foreign currency, illustrative — refresh annually):

| Currency | Rate |
|---|---|
| USD | 83.5 |
| EUR | 90.2 |
| GBP | 105.8 |
| JPY | 0.56 |
| AUD | 55.4 |
| CHF | 94.1 |
| CNY | 11.6 |
| ZAR | 4.5 |

## 4.4 PO status inference

Flag each row as `active` / `cancelled` / `reversed`:

- **Explicit status column wins** if present (e.g. `"Cancelled"`, `"Reversed"`, `"Invoice Posted"`, `"GRN Pending"` all → `active`)
- Otherwise:
  - `net_value < 0` → `reversed` (typical for return / reversal)
  - `net_value == 0` AND `quantity == 0` → `cancelled`
  - else → `active`

**Only `active` rows feed positive-spend rollups.** Cancelled + reversed still surface in audit reports but don't inflate spend totals.

## 4.5 Vendor normalisation

Build `canonical_vendor_name`:
1. Lowercase
2. Strip common suffixes: `Ltd`, `Ltd.`, `Pvt`, `Pvt.`, `Private`, `Limited`, `Pvt Ltd`, `Pvt.Ltd`, `&`, `and`
3. Collapse multiple spaces → single space
4. Trim

Result: `"Linde India Ltd"`, `"LINDE INDIA"`, `"linde india pvt ltd"` all roll up to `"linde india"`.

## 4.6 Lookback filter

Drop rows older than the engagement's scope window. Default: **last 18 months** from today.

```
cutoff = today - 18 months
keep rows where po_creation_date >= cutoff
```

Log the drop count + cutoff date.

## 4.7 Derived flags (Gold enrichment)

- **`is_capex`** = `True` if any of: `item_category == 'A'`, `material_type == 'ANLZ'`, GL account starts with CAPEX prefixes (`1501-1601`)
- **`po_type_inferred`** = `NB` (standard) / `FO` (framework) / `UB` (transfer). From `doc_type` when present; else heuristic on value + vendor type.
- **`is_pac`** = `True` if `short_text` contains any of: `PAC`, `PROPRIETARY`, `OEM ONLY`, `SOLE SOURCE`, `SINGLE SOURCE`
- **`is_emergency`** = `True` if PR-to-PO TAT < 3 days AND vendor is single-sourced

## 4.8 Cross-file join (for TAT)

When both PO and PR files are present, join to bring `pr_release_date` (or `pr_creation_date` fallback) into the PO DataFrame:

```
1. From PR file: dedupe on pr_number, take min(pr_release_date)
2. Join to PO file: po.pr_reference = pr.pr_number, left join
3. Now PO rows carry the PR date needed for TAT computation
```

If `pr_number` appears multiple times in the PR file (multi-line PR), take the earliest release date.

---

# Part 5 — The 8 KPIs

Each KPI is documented below with:
- **Question** — what it measures
- **Required columns** — hard prerequisites (KPI unavailable if missing)
- **Formula** — the exact calculation
- **Outlier handling** — how extreme values are treated
- **Availability** — what triggers "data not available"
- **Output shape** — headline + breakdowns

---

## KPI 1 — TAT (PR-to-PO Turnaround, days)

**Question:** how long from PR release/creation to PO creation, on average?

**Required columns:**
- PO: `po_number`, `po_creation_date`
- PR: `pr_number` + at least one of `pr_release_date` (preferred) or `pr_creation_date`

**Formula:**

```
Step 1 — Dedupe on po_number (multi-line POs):
    grouped = df.groupby('po_number').agg(
        po_dt = ('po_creation_date', 'min'),
        pr_dt = ('pr_release_date',  'min'),   # or pr_creation_date if release absent
    )

Step 2 — Compute TAT in days:
    grouped['tat_days'] = (grouped['po_dt'] - grouped['pr_dt']).days

Step 3 — Drop non-positive TATs (data errors):
    positive = grouped[grouped['tat_days'] > 0]

Step 4 — IQR upper-fence outlier removal (Tukey):
    Q1, Q3 = positive['tat_days'].quantile([0.25, 0.75])
    fence  = Q3 + 1.5 × (Q3 - Q1)
    trimmed = positive[positive['tat_days'] <= fence]

    Rule: if len(positive) < 10 rows, skip trim (too few rows for
          reliable IQR). Use all positive TATs.

Step 5 — Report the mean of trimmed:
    tat = round(trimmed['tat_days'].mean(), 1)
```

**Outlier philosophy (specific):** ONLY apply upper fence. Fast TATs are genuine performance, not errors. The extreme slow tail is almost always data quality issues (e.g., PRs from 3 years ago matched to current POs → 800-day TAT skews the mean).

**Availability:** unavailable if `po_number` OR `po_creation_date` OR both PR-date columns are missing, OR fewer than 1 row survives all filters.

**Output shape:**
```
{
  id: "tat",
  label: "TAT (PR-to-PO, days)",
  value: 14.3,
  unit: "days",
  direction: "lower_is_better",
  available: true,
  source_columns_used: ["po_number", "po_creation_date", "pr_release_date"],
  notes: "Mean PR→PO TAT, IQR-trimmed upper fence (1.5×). Joined from PR file.",
  per_canonical: [ {canonical_id, canonical_label, archetype, value, row_count} ],
  per_archetype: [ {archetype, value, row_count} ],
  data_quality: { required_cols, missing_cols, rows_available, rows_used, coverage_pct, per_column_completeness_pct },
  benchmark: { typical_low: 7, typical_high: 21, your_position: "within_typical" }
}
```

**Benchmark band:** 7-21 days (Indian steel/cement). <7 = best-in-class. >21 = process gap.

---

## KPI 2 — Savings over LPO %

**Question:** how much did the average price per material fall vs the previous purchase?

**Required columns:**
- PO: `net_price`, `po_creation_date`
- Ideal: `material_number` (for per-material path)

**Formula (per-material, volume-weighted — sharper method):**

```
Step 1 — Group PO lines by material and calendar month:
    per_mat_monthly = df.groupby(['material_number', month]).agg(
        avg_price = ('net_price', 'mean')
    )

Step 2 — Keep only materials with >=2 months of history:
    eligible = materials with 2+ monthly avg prices

Step 3 — Per material: latest vs prior month:
    for each eligible material:
        prior_p  = second-to-last month's avg_price
        latest_p = last month's avg_price
        if prior_p == 0: skip
        savings_pct = (prior_p - latest_p) / prior_p

Step 4 — Volume-weight the savings by material spend in the last 6 months:
    weight_per_mat = sum(net_price × quantity) for the material in
                     last 6 months (proxy for addressable spend)

    portfolio_savings_pct =
        Σ(per_material_savings_pct × weight_per_mat) / Σ(weight_per_mat)

Step 5 — Round to 1 dp, multiply by 100 for display:
    savings_over_lpo = round(portfolio_savings_pct × 100, 1)
```

**Fallback (portfolio-wide) when `material_number` is absent:**

```
month_avg = df.groupby(month)['net_price'].mean()
if len(month_avg) < 2: unavailable
latest, prior = month_avg.iloc[-1], month_avg.iloc[-2]
if prior == 0: unavailable
savings_over_lpo = round((prior - latest) / prior × 100, 1)
```

**Warning:** the portfolio fallback reflects mix-shift (buying more of cheap materials this month) more than price change. Surface a ⚠ note when this path fires.

**LPO derivation priority:**
1. `lpo_price` column if explicitly present (baseline / benchmark price)
2. Most recent prior purchase of same material within 2 years — used automatically by the per-material method
3. Unit: `net_price` or `net_price_per_unit`

**Sanity flag:** if `|savings| > 50%`, surface a warning — likely insufficient per-material history or synthetic price data. Real sustained sourcing savings rarely exceed ±15%.

**Outlier handling:** none applied explicitly. The volume-weighting naturally down-weights low-history materials. Extremes are surfaced as warnings not silently trimmed.

**Availability:** unavailable if no `net_price` column, no `po_creation_date`, or fewer than 2 months of positive-price data.

**Benchmark band:** 2-6%. >6% sustained YoY = mature category sourcing. <2% = price-taker.

---

## KPI 3 — RC Adoption %

**Question:** what % of PO lines are against active rate contracts (RC / OLA / framework), vs spot purchases?

**Required columns:**
- Any of: `contract_number`, `outline_agreement`, `scheduling_agreement`
- OR fallback: `po_type` (SAP document type)

**Formula (Method 1 — Agreement columns present):**

```
Step 1 — For each row, check ANY of the three contract-reference columns:

    exclusion_list = {
      "non arc", "non-arc", "no", "none", "n/a", "na", "0",
      "no contract", "spot", "open po", "non-rc", "nonrc", "non rc"
    }  # all case-insensitive

    has_contract = False
    for col in [contract_number, outline_agreement, scheduling_agreement]:
        if col in df.columns:
            v = df[col].astype(str).strip().lower()
            col_has = (v is not null AND v != '' AND v != 'nan'
                        AND v NOT IN exclusion_list)
            has_contract |= col_has

Step 2 — Compute rate:
    rc_adoption = round(has_contract.sum() / total_rows × 100, 1)
```

**Formula (Method 2 — Fallback via PO Type):**

Use only when no agreement column is populated. SAP `BSART` code mapping:

```
RC types (count as contracted):
    LP, LPA, WK, MK, KA, RC, blanket, framework
Spot types (not counted):
    NB (standard), and anything else
```

**Why the exclusion list matters:** real client data uses free-text placeholder values like `"Non ARC"`, `"n/a"`, `"None"`, `"0"` in contract fields. Without the exclusion list, these would count as "has a contract" and inflate the metric.

**Outlier handling:** none.

**Availability:** unavailable if NONE of contract_number / outline_agreement / scheduling_agreement columns exist.

**Data quality mode:** `any_of` — coverage_pct = rows where *at least one* of the three columns is populated (with a real value). Missing all three ≠ 0% RC adoption — the metric is genuinely unavailable.

**Benchmark band:** 35-55%. >55% = strong sourcing maturity. <35% = tail spend exposure.

---

## KPI 4 — PAC / Single-Vendor PRs %

**Question:** what % of unique POs are Proprietary Article Certificate (PAC) / single-source?

**Required columns:**
- `po_number` (always)
- Any of the PAC binary flag columns OR the text columns for keyword scan

**PAC flag columns (priority order — first found wins):**
```
pac_flag  →  pac_pr  →  pac  →  single_source_flag  →  PAC_Flag  →  PAC
```

**Yes-values accepted for flag:**
```
yes, y, true, "1", pac, "single source", "sole source"
```
Case-insensitive comparison, after stripping whitespace.

**Text scan (fallback / additional):**

Scan these columns for keywords: `short_text`, `pr_text`, `remarks`, `reason`

Keywords (uppercase, exact substring — regex disabled to avoid over-matching):
- `PAC`
- `PROPRIETARY`
- `OEM ONLY`
- `SOLE SOURCE`
- `SINGLE SOURCE`

**Formula:**

```
Step 1 — Per-row PAC flag (union of flag column + text scan):
    row_pac = flag_col_says_yes OR any_keyword_matches_text

Step 2 — Aggregate to PO level (a PO is PAC if ANY line is PAC):
    per_po = df.groupby('po_number')['row_pac'].any()

Step 3 — Denominator is unique PO count, NOT unique line count:
    pac_pct = round(per_po.sum() / len(per_po) × 100, 1)
```

**Why PO-level not line-level:** a 10-line PO with 1 PAC line and 9 non-PAC lines should count as 1 PAC PO, not "10% PAC lines". PAC is a PO-level decision.

**Outlier handling:** none.

**Availability:** unavailable if no `po_number`. Fully-zero output if `po_number` exists but no PAC flag or text hits anywhere (interpreted as "0% PAC" not "unavailable").

**Benchmark band:** 8-20%. >20% = competition risk. <8% = best-in-class diversification.

---

## KPI 5 — Tail Spend %

**Question:** what % of PO lines are below ₹1 Lakh in value?

**Required columns:**
- `net_value` (or `net_value_inr` if already normalised upstream)

**Fixed threshold:** ₹1,00,000 (₹1 Lakh) per PO line. **Not configurable.**

**Formula:**

```
Step 1 — Detect unit (INR vs Crore vs already-normalised):

    if column name contains 'cr' or 'crore':
        values are in Crore → multiply by 1e7 first
    elif median of positive values < 10:
        values are likely in Crore → multiply by 1e7
    else:
        already in raw INR

Step 2 — Count lines below threshold:
    tail_pct = round((s < 100000).sum() / len(s) × 100, 1)
```

**Why line-count not spend-value:** the metric measures *transactional drag* — how many small POs are consuming buyer time. A 40% tail spend means 40% of PO lines are small enough that catalogue / OLA would be more efficient than spot buying.

**Outlier handling:** implicit via unit detection. No explicit trimming.

**Availability:** unavailable if no `net_value` column exists or all values are NaN.

**Benchmark band:** 35-55%. >55% = excessive transactional drag. <35% = strong consolidation.

---

## KPI 6 — Spend per FTE (₹ Cr/FTE)

**Question:** how much addressable spend does each procurement FTE manage?

**Required inputs:**
- PO: `net_value` (or `net_value_inr`)
- Engagement profile: `fte_count` (client-provided in Stage 1)

**Formula:**

```
Step 1 — Sum-based unit detection (from raw net_value column):

    total = sum(pd.to_numeric(net_value, errors='coerce'))

    if total >= 1e7:  # raw INR (e.g., 8_400_000_000)
        cr = total / 1e7
    elif total >= 1e5: # thousands (e.g., 84_000_000 meaning 8.4 Cr in K)
        cr = total / 1e5
    else:              # already in Crore
        cr = total

Step 2 — Divide by FTE count:
    spend_per_fte = round(cr / fte_count, 2)
```

**Why sum-based unit detection (not median or max):**
- **Median fails** when many small line items drag the median below ₹1 Lakh even though total spend is ₹400 Cr+
- **Max fails** when no single line exceeds ₹1 Cr even though total is clearly hundreds of Crore
- **Sum is the only reliable signal at portfolio scale**

**Preprocessing before summing:** strip commas from strings (`"1,23,456"` → `123456`). Without this, `pd.to_numeric` silently zeroes the entire spend column and everyone's spend per FTE is ₹0.

**Outlier handling:** none. Use all active rows.

**Availability:** unavailable if `fte_count` is 0/null OR no `net_value` column.

**Benchmark band:** 75-175 ₹ Cr/FTE. >175 = lean operations. <75 = potential over-staffing or low automation.

---

## KPI 7 — On-Time Delivery %

**Question:** what % of deliveries arrived on or before the promised date?

**Required columns:** `delivery_date`, `gr_date`

**Formula:**

```
Step 1 — Denominator = only POs that have BOTH dates populated:
    dfx = df.dropna(subset=['delivery_date', 'gr_date'])
    (Undelivered / open POs are excluded from the denominator entirely.)

Step 2 — Parse both as dates:
    delivery_date and gr_date → datetime
    Drop rows where either failed to parse

Step 3 — Strict comparison (no grace period):
    on_time = gr_date <= delivery_date
    # NOT gr_date <= delivery_date + 1_day
    # NOT gr_date <= delivery_date + 3_days

Step 4 — Optional strictness bump (when quantity data present):
    Full delivery required. If gr_quantity < po_quantity, the PO is
    NOT counted as on-time even if the GR date was on time.
    Partial delivery = not on-time.

Step 5 — Compute rate:
    otd = round(on_time.sum() / len(dfx) × 100, 1)
```

**Outlier handling:** none. Every delivered PO counts.

**Availability:** unavailable if either date column is missing, or no rows have both.

**Benchmark band:** 75-92%. >92% = best-in-class. <75% = supplier reliability gap.

---

## KPI 8 — Sourcing Tool Usage %

**Question:** what % of sourcing events run through an e-sourcing platform (vs email / Excel / paper)?

**V1 — QRE-derived proxy** (until real ERP e-sourcing integration is possible):

```
QRE D12.1 answer (digital sourcing maturity, 0-4) → % mapping:
    Score 1 → 10%
    Score 2 → 35%
    Score 3 → 65%
    Score 4 → 90%
```

**V2 — Actual measurement from ERP data:**

```
Count RFQ events by source:
    (# RFQs routed through e-sourcing platform)
    / (# total RFQs in the period)
    × 100
```

Requires the client's e-sourcing platform (Ariba, Coupa, Bidder360, etc.) to expose RFQ data via API or export.

**Outlier handling:** none.

**Availability:** unavailable if QRE D12.1 not answered AND no ERP integration.

**Benchmark band:** 30-65%. >65% = mature digital sourcing. <30% = paper/email-driven.

---

# Part 6 — Outlier Philosophy (General)

## Principle 1 — Upper fence only

When trimming, only apply the upper Tukey fence: `Q3 + 1.5 × IQR`. Never trim the lower fence.

**Rationale:** in procurement KPIs, "fast" and "good" numbers are almost always real performance. It's the extreme slow / bad tail that's usually a data quality issue.

Examples:
- **TAT:** a 0.5-day TAT is real (auto-conversion from PR to PO). An 800-day TAT is almost certainly a matching error where a re-opened PR from 3 years ago got paired to a recent PO.
- **Savings:** a 20% savings is real (successful renegotiation). A 90% savings is almost certainly a data error (missing decimal, unit mismatch, synthetic price).
- **RC Adoption:** every value between 0-100% is valid — no trimming.

## Principle 2 — Minimum rows before trimming

If fewer than **10 rows** remain after basic cleanup (drop null / negative / non-positive), skip IQR trimming entirely. IQR statistics on <10 points produce unreliable fences.

## Principle 3 — Never silently drop good data

If you trim, log:
- Count before trim
- Count after trim
- Fence value used
- Sample rows just outside the fence (for consultant to review)

Consultant can override the trim if they know the extreme values are real.

## Principle 4 — Sanity flags over silent capping

For metrics with expected ranges (e.g. Savings over LPO between ±15%), surface a ⚠ warning when outside range. Don't silently cap the number — let the consultant decide.

---

# Part 7 — Time Period Rules

## 7.1 Scope lookback window

Set at engagement level (Stage 2). Default: **18 months**.

```
cutoff_date = today - lookback_months × 30 days
```

Rows with `po_creation_date < cutoff_date` are dropped from all analyses. Log the drop count.

**Consultant guidance:**
- **12 months minimum** for meaningful trend
- **18 months** = default, gives 2 fiscal year comparisons
- **24 months** = deeper history but ERP data quality often degrades further back
- **36 months** = only if client wants pre-COVID vs post-COVID comparison

## 7.2 Multi-sheet FY tabs

When the workbook has FY22 / FY23 / FY24 tabs, all rows are concatenated with a `_source_sheet` column. The lookback still applies globally on `po_creation_date` — an FY22 tab won't survive if it's older than 18 months.

## 7.3 TAT per-month rolling

TAT is computed on the whole window at once. Per-month breakdown (for trend charts) uses:

```
Step 1 — Group by po_creation_date.dt.to_period('M')
Step 2 — Apply the same IQR-trim per month (still with min 10 rows)
Step 3 — Report mean per month
```

## 7.4 Savings — 2 months minimum

Savings over LPO requires at least 2 calendar months of `po_creation_date` data. Fewer than 2 → KPI unavailable.

## 7.5 Volume-weighted last-6-months

The per-material savings weighting uses the last 6 months (of the window) to compute material weight. Rationale: recent buying reflects the material's current addressable spend, not historical.

## 7.6 Rolling 6-month PO count (for Buying Channel)

`po_count_6mo` for a material group = max PO count in any rolling 180-day window. Used by buying channel rules to distinguish high-frequency (catalogue candidate) from low-frequency (project buy).

Algorithm:
```
sort po_creation_date ascending
for each row i:
    j = smallest index where date[j] - date[i] > 180 days
    count = j - i
    track max_count
```

O(n) sliding window; single pass.

---

# Part 8 — Data Quality Reporting (per KPI)

Every KPI result carries a `data_quality` block for transparency:

```
{
  required_cols: ["po_number", "po_creation_date", "pr_release_date"],
  mode: "all_of",              # or "any_of" for RC Adoption
  missing_cols: [],
  rows_available: 500,         # rows in the dataset
  rows_used: 462,              # rows where all required_cols are populated
  coverage_pct: 92.4,          # rows_used / rows_available
  per_column_completeness_pct: {
    "po_number": 100.0,
    "po_creation_date": 100.0,
    "pr_release_date": 92.4
  }
}
```

**Modes:**
- **`all_of`** (default): rows_used = rows where every required column is populated. TAT, OTD, Savings, Spend/FTE.
- **`any_of`**: rows_used = rows where at least one required column is populated. RC Adoption (any of 3 contract columns).

**Consultant surfaces this as:** "Coverage: 92.4% (462 of 500 rows had all required fields)". Values below 80% get a ⚠ badge.

---

# Part 9 — Benchmark Bands

Every KPI has a typical band representing Indian large-enterprise procurement (steel/cement). UI shows: `your X vs typical [low, high]` with a directional cue.

| KPI | Typical Low | Typical High | Unit | Direction |
|---|---|---|---|---|
| TAT | 7 | 21 | days | lower_is_better |
| Savings over LPO | 2 | 6 | % | higher_is_better |
| RC Adoption | 35 | 55 | % | higher_is_better |
| PAC / Single-Vendor | 8 | 20 | % | lower_is_better |
| Tail Spend | 35 | 55 | % | lower_is_better |
| Spend per FTE | 75 | 175 | ₹ Cr/FTE | higher_is_better |
| OTD | 75 | 92 | % | higher_is_better |
| Sourcing Tool Usage | 30 | 65 | % | higher_is_better |

**Positions:**
- **`within_typical`** — grey/neutral badge
- **`above_typical_good`** / **`below_typical_good`** — green badge (good side of the band)
- **`above_typical_bad`** / **`below_typical`** — amber/red badge (bad side of the band)

**Direction logic:**
- `higher_is_better`: value < low → below_typical (bad); value > high → above_typical_good; else within
- `lower_is_better`: value > high → above_typical_bad; value < low → below_typical_good; else within

---

# Part 10 — Breakdowns (drill-down)

Every KPI is computed at 3 levels:
1. **Headline** — one number for the whole dataset
2. **Per canonical category** — the KPI computed separately per Stage 9 canonical (e.g. Iron Ore's TAT vs Bearings' TAT)
3. **Per archetype** — grouped by BULK / DIRECT / INDIRECT / SERVICE / CAPEX

For each breakdown row:
```
{
  canonical_id: "iron_ore",              # or archetype: "BULK"
  canonical_label: "Iron Ore",
  archetype: "BULK",
  value: 6.8,                            # KPI computed on this subset
  row_count: 42                          # rows in this subset
}
```

**Rules for breakdowns:**
- Subsets with fewer than 5 rows → still show the value but mark low-confidence
- Subsets with 0 rows → don't appear at all
- UNCLASSIFIED canonical always shows separately if present (useful data-quality signal)

---

# Part 11 — Dashboard Layout & Representation

## 11.1 Page structure

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER: engagement name + industry + PO row count + FTE count    │
├──────────────────────────────────────────────────────────────────┤
│ DATA QUALITY STRIP:                                              │
│   Classified: 92% · Unclassified: 8% (₹120 Cr) · Lookback: 18mo │
├──────────────────────────────────────────────────────────────────┤
│ PORTFOLIO HERO:                                                  │
│   Total spend  ₹2,140 Cr                                         │
│   PO count     500                                               │
│   Vendors      92                                                │
│   Plants       4                                                 │
│   FYs          FY22–FY24                                         │
├──────────────────────────────────────────────────────────────────┤
│ FILTER CHIP BAR:                                                 │
│   [ Plants ▼ ]  [ Categories ▼ ]  [ Period start-end ]  [Apply] │
├──────────┬───────────────────────────────────────────────────────┤
│ SIDEBAR  │ TOP BAR: search · sort · view(grid/list/trend) count  │
│          ├───────────────────────────────────────────────────────┤
│ Op Model │                                                       │
│ (score)  │ KPI GRID / LIST / TREND VIEW                          │
│          │                                                       │
│ Org      │ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│ Struct.  │ │ TAT      │ │ Savings  │ │ RC Adopt │  ...          │
│ (score)  │ │ 14.3 d   │ │  3.2 %   │ │  42 %    │               │
│          │ │ [band]   │ │ [band]   │ │ [band]   │               │
│ Buying   │ └──────────┘ └──────────┘ └──────────┘               │
│ Channel  │                                                       │
│ (score)  │                                                       │
│          │                                                       │
│ DoA      │                                                       │
│ (score)  │                                                       │
└──────────┴───────────────────────────────────────────────────────┘
                                                                    
Click any KPI card → opens a DRAWER with the full drill-down:      
  ┌────────────────────────────────────────────────────────────┐   
  │ TAT (PR-to-PO, days) — 14.3 days                           │   
  │                                                            │   
  │ Benchmark: 7–21 days (steel) · Position: within typical    │   
  │                                                            │   
  │ Formula walkthrough (with the actual numbers plugged in):  │   
  │   500 rows → 462 with all required fields                  │   
  │   462 → 448 after dropping non-positive TATs               │   
  │   IQR fence: 45.8 days → 12 rows above fence dropped       │   
  │   Final mean of 436 rows: 14.3 days                        │   
  │                                                            │   
  │ Per canonical:                                             │   
  │   Iron Ore          6.8 d  (42 rows)                       │   
  │   Coking Coal      12.1 d  (28 rows)                       │   
  │   Ferro Alloys     18.4 d  (47 rows)                       │   
  │   ...                                                      │   
  │                                                            │   
  │ Per archetype:                                             │   
  │   BULK      10.2 d  (192 rows)                             │   
  │   DIRECT    13.7 d  (140 rows)                             │   
  │   INDIRECT  22.1 d  ( 98 rows)                             │   
  │   ...                                                      │   
  │                                                            │   
  │ Data quality: 92.4% coverage                               │   
  │   po_number:         100%                                  │   
  │   po_creation_date:  100%                                  │   
  │   pr_release_date:    92.4%                                │   
  │                                                            │   
  │ Source: kb/_meta/kpi-calculation-rules.yml#tat             │   
  └────────────────────────────────────────────────────────────┘   
```

## 11.2 KPI card design

Each card shows:
- KPI name + unit (e.g. `TAT (PR-to-PO, days)`)
- **Value** (large, prominent — e.g. `14.3`)
- **Direction indicator** (small arrow up/down showing whether higher is better)
- **Benchmark band** as a horizontal mini-bar with the client's position marked
- **Data quality badge** — green if coverage ≥ 90%, amber if 70-90%, red if < 70%
- **Pillar tag** in a corner (which pillar this KPI belongs to)
- Click → opens drawer

## 11.3 Grid vs List vs Trend view

- **Grid** (default): visual cards, best for scanning
- **List**: dense table with sortable columns (KPI, value, benchmark, coverage, pillar) — best for cross-comparison
- **Trend**: 3-month rolling values as sparklines — best for spotting deterioration

## 11.4 Sidebar — pillar filter

Shows all 4 pillars with their maturity scores. Click a pillar to filter the KPI list to only that pillar's KPIs.

```
┌─────────────────────┐
│ ALL          8/8    │
├─────────────────────┤
│ Op Model     3.0    │  ← click to filter
│   4 KPIs            │
├─────────────────────┤
│ Org Struct   2.5    │
│   1 KPI             │
├─────────────────────┤
│ Buying Chan  3.5    │
│   2 KPIs            │
├─────────────────────┤
│ DoA          2.0    │
│   1 KPI             │
└─────────────────────┘
```

## 11.5 Search + sort

Top bar has:
- **Search box** — filters KPI list by name / pillar / theme
- **Sort dropdown** — Name / Pillar / Value
- **View toggle** — Grid / List / Trend

## 11.6 Drill-down filters (page-level)

The filter chip bar at top lets the consultant re-run all KPIs against a subset of the PO data:
- **Plants** — multi-select from the plants present in data
- **Categories** — multi-select from canonical categories
- **Period start-end** — calendar range within the lookback window

When filters are applied, backend re-runs the whole KPI pipeline against the filtered subset. Takes 2-5 seconds; dashboard stays visible with a "recomputing" badge.

## 11.7 Colour + directional cues

- **Green** = better than benchmark (client in a good place)
- **Amber** = within benchmark
- **Red** = worse than benchmark
- **Grey** = data not available

Never rely on colour alone — pair with icons (↑ / ↓ / ⚠) for accessibility.

---

# Part 12 — Output Data Contract

For a KPI list that a downstream tool consumes, the shape is:

```json
{
  "engagement_id": "eng_1234",
  "generated_at": "2026-06-11T05:30:00Z",
  "lookback_months": 18,
  "cutoff_date": "2024-12-11",
  "portfolio": {
    "total_spend_inr_cr": 2140.3,
    "total_po_count": 500,
    "total_vendor_count": 92,
    "plant_count": 4,
    "period_start": "2023-01-15",
    "period_end": "2024-12-08"
  },
  "kpis": [
    {
      "id": "tat",
      "label": "TAT (PR-to-PO, days)",
      "value": 14.3,
      "unit": "days",
      "available": true,
      "direction": "lower_is_better",
      "source_columns_used": ["po_number", "po_creation_date", "pr_release_date"],
      "notes": "Mean PR→PO TAT, IQR-trimmed upper fence (1.5×). Joined from PR file.",
      "source": "kb/_meta/kpi-calculation-rules.yml#tat",
      "per_canonical": [
        { "canonical_id": "iron_ore", "canonical_label": "Iron Ore", "archetype": "BULK", "value": 6.8, "row_count": 42 }
      ],
      "per_archetype": [
        { "archetype": "BULK", "value": 10.2, "row_count": 192 }
      ],
      "data_quality": {
        "required_cols": ["po_number", "po_creation_date", "pr_release_date"],
        "mode": "all_of",
        "missing_cols": [],
        "rows_available": 500,
        "rows_used": 462,
        "coverage_pct": 92.4,
        "per_column_completeness_pct": {
          "po_number": 100.0, "po_creation_date": 100.0, "pr_release_date": 92.4
        }
      },
      "benchmark": {
        "typical_low": 7, "typical_high": 21, "unit": "days",
        "direction": "lower_is_better",
        "your_position": "within_typical",
        "note": "Median PR-to-PO TAT across Indian steel/cement engagements."
      }
    }
  ]
}
```

---

# Appendix A — How to apply this manually (no tool)

1. Get PO + PR Excel dumps from the client.
2. Combine sheets if multi-tab (Part 3). Add `_source_sheet` column.
3. Run cleansing (Part 4) end-to-end.
4. Confirm column mapping (Part 2). Fill obvious gaps manually.
5. For each of the 8 KPIs:
   - Check required columns present (Part 5)
   - Apply formula (Part 5)
   - Apply outlier trim if applicable (Parts 5 + 6)
   - Compute breakdown per canonical / archetype (Part 10)
   - Compute data quality block (Part 8)
   - Compare to benchmark (Part 9)
6. Assemble into the output structure (Part 12).
7. Present per dashboard layout (Part 11).

Total effort for a 500-row PO dump + PR dump: ~3 hours in Excel/pandas.

---

# Appendix B — Common failure modes to guard against

| Symptom | Root cause | Fix |
|---|---|---|
| All spend appears as ₹0 | Commas in the `Net Value` column not stripped before numeric coerce | Strip commas before `pd.to_numeric` |
| Tail Spend = 100% | Values were in ₹Cr but unit detection failed | Check median-based detection or column name hints |
| TAT = 400 days | Untrimmed outliers from date matching errors | Ensure IQR trim is applied |
| RC Adoption = 100% | Contract column has junk text like `"Non ARC"` not being excluded | Extend the exclusion list |
| Savings = 89% | Insufficient per-material history OR synthetic prices | Surface as ⚠ warning; don't silently show |
| OTD = 0% | `delivery_date` never populated in source PO dump | Mark KPI unavailable |
| Spend/FTE = 0.03 Cr | `fte_count` was interpreted as enterprise headcount, not procurement FTE | Confirm with client — procurement FTE only |
| PAC = 40% | Text scan matching `PAC` inside longer words | Use `str.upper().contains("PAC")` with word boundaries or explicit token match |
| PR-to-PO join yields 0 rows | `PR Number` in PR file has leading zeros stripped by Excel | Force both join keys to string, strip whitespace, cast dtype |

---

# Appendix C — What this document does NOT cover

- **Op Model, DoA, Buying Channel, Org Structure pillar analyses** — separate handoff docs (`OP_MODEL_RULES.md`, `DOA_RULES.md`, `BUYING_CHANNEL_RULES.md`, `ORG_STRUCTURE_RULES.md`)
- **RCA rules** — separate doc (`RCA_OFFERINGS.md` when created)
- **AI narrative generation** — the app composes these via Gemini with KB grounding; not part of the KPI methodology
- **Category classification cascade (Stage 9)** — covered in `OP_MODEL_RULES.md` Part 2
- **Vendor Master / Material Master / GRN / Invoice pillars** — V2 pillars, separate rules

---

**Version:** 1.0 · **Last updated:** consistent with `main` branch tip. Refresh when KPI rules in `kb/_meta/kpi-calculation-rules.yml` change.
