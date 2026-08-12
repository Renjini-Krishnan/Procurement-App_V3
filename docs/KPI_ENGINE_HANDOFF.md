# KPI Engine — Standalone Handoff

> **For someone porting just the KPI calculation + visualization to a different tool.** No maturity scoring, no root-cause analysis, no assessment framework — pure numbers from PO + PR data, plus how to render them.

**Scope:** 8 procurement KPIs · cleansing pipeline · category-slicing for breakdowns · dashboard layout · data-quality reporting · benchmarks · output contract.

**Explicitly NOT covered:** any pillar-based scoring (Op Model / DoA / Buying Channel / Org Structure), RCA recommendations, or maturity verdicts. This doc treats KPIs as first-class outputs, not as inputs to a larger assessment.

---

# Part 1 — The 8 KPIs at a glance

| # | KPI | Unit | Direction | Benchmark band | Requires |
|---|---|---|---|---|---|
| 1 | TAT (PR-to-PO) | days | lower better | 7–21 | PO + PR |
| 2 | Savings over LPO | % | higher better | 2–6 | PO |
| 3 | RC Adoption | % | higher better | 35–55 | PO |
| 4 | PAC / Single-Vendor | % | lower better | 8–20 | PO |
| 5 | Tail Spend | % | lower better | 35–55 | PO |
| 6 | Spend per FTE | ₹ Cr/FTE | higher better | 75–175 | PO + FTE count |
| 7 | On-Time Delivery | % | higher better | 75–92 | PO with GR + delivery dates |
| 8 | Sourcing Tool Usage | % | higher better | 30–65 | QRE proxy (V1) / e-sourcing platform (V2) |

Every KPI outputs: **headline value + benchmark position + per-category breakdown + data-quality coverage** (details in Part 11 + 12).

---

# Part 2 — Data Source Matrix (which KPI uses which column from which file)

Read left-to-right: pick a KPI, then see what source file(s) you need + which columns.

| KPI | PO dump | PR dump | External input | Optional supporting files |
|---|---|---|---|---|
| **1. TAT** | `po_number` · `po_creation_date` · `pr_reference` | `pr_number` + `pr_release_date` (or `pr_creation_date`) | — | — |
| **2. Savings over LPO** | `net_price` · `po_creation_date` · `material_number` (preferred) | — | — | — |
| **3. RC Adoption** | Any of: `contract_number` · `outline_agreement` · `scheduling_agreement`. Fallback: `po_type` | — | — | **CONTRACT_MASTER** (`contract_number`, `contract_start_date`, `contract_end_date`) — sharpens by validating active contracts vs PO date |
| **4. PAC / Single-Vendor** | `po_number` + any of: `pac_flag` · `pac_pr` · `pac` · `single_source_flag` · `PAC_Flag` · `PAC`. Fallback: `short_text` · `pr_text` · `remarks` · `reason` (text scan) | — | — | — |
| **5. Tail Spend** | `net_value` (or `net_value_inr`) | — | — | — |
| **6. Spend per FTE** | `net_value` (or `net_value_inr`) | — | `fte_count` (procurement FTE only) | **ORG_STRUCTURE** master (`employee_id`, `status`, `fte_factor`) — replaces manual FTE count with derived active-employee count |
| **7. On-Time Delivery** | `delivery_date` · `gr_date` (+ optional `quantity` · `gr_quantity` for partial-delivery strictness) | — | — | **GRN** file (`grn_number`, `po_number`, `posting_date`, `movement_type`, `quantity`) — sharper, filters by movement_type=101 (receipt) and excludes 102 (reversal) |
| **8. Sourcing Tool Usage** | — | — | QRE D12.1 (digital sourcing maturity, 0-4) | E-sourcing platform export (Ariba / Coupa / Bidder360 etc.) — turns the proxy into a real % of RFQs routed digitally |

## What each source file is for

| Source | Purpose | Required for these KPIs |
|---|---|---|
| **PO dump** | Line-level purchase order records | 2, 3, 4, 5, 6, 7 (all except 1's PR-date + 8) |
| **PR dump** | Purchase requisition records | 1 only |
| **External `fte_count`** | Consultant enters procurement FTE | 6 only |
| **QRE D12.1** | Digital sourcing maturity score | 8 (V1 proxy) |
| **CONTRACT_MASTER** *(optional)* | Rate contract catalogue | Sharpens KPI 3 (active-vs-lapsed check) |
| **ORG_STRUCTURE** *(optional)* | Employee master | Sharpens KPI 6 (derived FTE) |
| **GRN** *(optional)* | Goods receipt records | Sharpens KPI 7 (multi-GRN per PO handling) |
| **INVOICE** *(optional)* | Invoice records | Enables 3-way match KPI (out of scope for this V1 doc) |
| **VENDOR_MASTER** *(optional)* | Vendor catalogue | Enables MSME share, HHI concentration (out of scope) |
| **MATERIAL_MASTER** *(optional)* | Material catalogue | Enables master-quality KPIs (out of scope) |

## Minimum viable input

- **PO dump alone**: gives you KPIs 2, 3, 4, 5, 6 (with FTE input), 7 (if PO has GR + delivery dates)
- **PO + PR dumps**: adds KPI 1 (TAT)
- **PO + PR + QRE D12.1 answered**: all 8 KPIs

## Zero-cost sharpeners

If the client has the optional files, each unlocks a sharper computation:

- **CONTRACT_MASTER** → validate that the referenced contract was *active* on the PO date (not lapsed, not future-dated)
- **ORG_STRUCTURE** → derive `fte_count` from active procurement headcount instead of a single manual number
- **GRN** → for POs with multiple partial receipts, use the earliest full-delivery GRN for OTD instead of the PO-level `gr_date`

---

# Part 3 — Full Column Specifications by File

## 3.1 PO dump — required columns

Column names are canonical; source files use varied labels — see Part 4 for mapping.

| Canonical name | SAP field | Type | Required? | Which KPI(s) use it |
|---|---|---|---|---|
| `po_number` | EBELN | string | Yes | 1, 4 (dedup + PAC PO-level count) |
| `po_item` | EBELP | int | Yes | Line ID |
| `po_creation_date` | BEDAT | date | Yes | 1, 2 (period slicing) |
| `net_value` | NETWR | number | Yes | 5, 6 (all spend KPIs) |
| `currency` | WAERS | string | Yes | FX conversion to INR |
| `net_price` | NETPR | number | For KPI 2 | Savings over LPO |
| `material_number` | MATNR | string | Preferred for KPI 2 | Per-material savings path (sharper) |
| `quantity` | MENGE | number | Optional | OTD strictness |
| `gr_quantity` | MSEG.MENGE | number | Optional | OTD strictness |
| `delivery_date` | EINDT | date | For KPI 7 | OTD numerator |
| `gr_date` | MSEG.BUDAT | date | For KPI 7 | OTD numerator |
| `pr_reference` | BANFN | string | For KPI 1 | TAT join to PR file |
| `contract_number` | KONNR | string | For KPI 3 (any of 3) | RC Adoption |
| `outline_agreement` | — | string | For KPI 3 (any of 3) | RC Adoption |
| `scheduling_agreement` | — | string | For KPI 3 (any of 3) | RC Adoption |
| `po_type` | BSART | string | For KPI 3 fallback | RC Adoption Method 2 |
| `short_text` | TXZ01 | string | For KPI 4 text-scan | PAC text detection |
| `pac_flag` (or `pac`, `pac_pr`, `single_source_flag`) | custom | string/bool | For KPI 4 flag | PAC explicit flag |

**Not required for KPIs** but improve category-based breakdowns (Part 11):
`plant`, `purchase_group`, `vendor_id`, `vendor_name`, `material_group`, `material_group_desc`.

## 3.2 PR dump — required columns

Only needed for KPI 1 (TAT). Without a PR file, TAT is unavailable.

| Canonical name | SAP field | Type | Required? |
|---|---|---|---|
| `pr_number` | BANFN | string | Yes (join key to `po.pr_reference`) |
| `pr_release_date` | FRGDT | date | Preferred |
| `pr_creation_date` | ERDAT | date | Fallback if release absent |

Priority for TAT clock start: **`pr_release_date` > `pr_creation_date`**. Release captures the approval-out moment; creation includes approval delay upstream.

## 3.3 One external input (not from files)

| Input | Type | Used by |
|---|---|---|
| `fte_count` | int | KPI 6 (Spend per FTE) |

Consultant-provided. Procurement FTE count, **not enterprise headcount**.

---

# Part 4 — Column Mapping (6-level fallback)

Real files never use canonical names. Handle mapping in order:

1. **User-confirmed override** (always wins)
2. **Exact match** — `PO_Number` == `po_number` after case + underscore normalisation
3. **Case-insensitive match** — `PO Number` == `po_number`
4. **Underscore ↔ space normalised** — `Net Value` == `Net_Value` == `net_value`
5. **Known alias list** — e.g. `Pur.Order Number`, `PO Doc Date`, `Vendo Name` (typos), `EBELN`
6. **LLM enrichment** (optional) — send unknown header + first 5 sample values + schema, ask model to map

**Silent failure is banned.** If a required column isn't found after all fallbacks, the KPI is marked `available: False` and shown as `—`. Never compute with wrong data.

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
| `contract_number` | Contract Number, Contract, KONNR, Agreement Number, ARC Number |
| `outline_agreement` | Outline Agreement, Framework Agreement, OLA |
| `scheduling_agreement` | Scheduling Agreement, Blanket Order |
| `delivery_date` | Delivery Date, Promised Date, Required Date, EINDT |
| `gr_date` | GR Date, GRN Date, Receipt Date, Posting Date |
| `material_number` | Material Number, Material Code, MATNR |
| `plant` | Plant, Plant Code, WERKS, Location |

---

# Part 5 — Multi-Sheet Excel Handling

Real client dumps often arrive as one Excel with one sheet per financial year (FY22 / FY23 / FY24).

## Rules

1. **Read every sheet** — `pd.read_excel(file, sheet_name=None)` returns `{sheet_name: DataFrame}`
2. **Vertical concat with source tag** — combine into one DataFrame, add a `_source_sheet` column tagging each row with its origin sheet
3. **Skip empty sheets** (0 rows) — record with reason `empty`
4. **Skip cover pages** — heuristic: ≤ 2 columns AND first row's non-blank cell count ≤ half column count. Reason: `looks_like_cover_page`
5. **Handle schema drift** — if not all sheets have the same columns, pandas NaN-pads automatically. Surface a `schema_drift` warning
6. **Preserve `_source_sheet`** through cleansing so KPI breakdowns can slice by FY tab if needed

## Consultant-facing panel

Before running:

```
Sheets loaded from PO_Data.xlsx:
  Cover    EXCL (cover page)         1 row · 1 col
  FY22     INCL                    166 rows · 26 cols
  FY23     INCL                    166 rows · 26 cols
  FY24     INCL                    168 rows · 26 cols
Combined: 500 rows
Warnings: schema_drift (FY24 has 'EXTWG' column not in FY22/FY23)
```

---

# Part 6 — Data Cleansing Pipeline

Apply in strict order on the combined DataFrame:

## 6.1 Type coercion

- **Dates:** parse from DD-MM-YYYY, DD.MM.YYYY, ISO YYYY-MM-DD, Excel serial (integer days since 1900-01-01). Bad → `NaT`, flagged not dropped.
- **Numbers:** `pd.to_numeric(errors="coerce")` — bad → NaN
- **Text:** strip whitespace, `NaN` → empty string

## 6.2 Indian number-format handling

Real Indian source data uses commas: `"1,23,456.78"`. Default numeric coerce sends these to NaN, silently zeroing the spend column.

**Rule:** for any string column expected to hold numbers, strip commas before conversion: `s.str.replace(",", "")`. Then coerce.

## 6.3 Currency normalisation

Every row gets a parallel `net_value_inr` column.

Priority:
1. Currency = `INR` → `net_value_inr = net_value`
2. Currency ≠ `INR` → look up FX rate for `(currency, po_creation_date)`. If no period-specific table, use annual average.
3. Store `fx_rate_applied` on the row for audit.

Default rate table (INR per unit foreign currency — refresh annually):

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

## 6.4 PO status inference

Flag each row as `active` / `cancelled` / `reversed`:

- Explicit status column wins if present
- Otherwise:
  - `net_value < 0` → `reversed` (typical for return / reversal)
  - `net_value == 0` AND `quantity == 0` → `cancelled`
  - else → `active`

**Only `active` rows feed all KPI computations.** Cancelled + reversed surface in audit reports but don't inflate numbers.

## 6.5 Vendor normalisation (optional but recommended)

Build `canonical_vendor_name`:
1. Lowercase
2. Strip suffixes: `Ltd`, `Ltd.`, `Pvt`, `Pvt.`, `Private`, `Limited`, `Pvt Ltd`, `Pvt.Ltd`, `&`, `and`
3. Collapse whitespace

`"Linde India Ltd"`, `"LINDE INDIA"`, `"linde india pvt ltd"` → `"linde india"`.

## 6.6 Lookback filter

Drop rows older than the analysis window. Default: **last 18 months from today**.

```
cutoff = today - 18 months
keep rows where po_creation_date >= cutoff
```

Log the drop count + cutoff date.

## 6.7 Cross-file PR join (for KPI 1 TAT)

When both PO and PR files are present:

```
1. From PR file: dedupe on pr_number, take min(pr_release_date)
   (or min(pr_creation_date) as fallback)
2. Join to PO file: po.pr_reference = pr.pr_number, LEFT JOIN
3. PO rows now carry the PR date needed for TAT
```

If `pr_number` appears multiple times in the PR file (multi-line PR), take the earliest release date.

---

# Part 7 — Category Classification (optional, for per-category breakdowns)

**Fully optional.** All 8 KPIs compute correctly at portfolio level without categorising anything. If you want per-category breakdowns (e.g. Iron Ore's TAT vs Bearings' TAT), classify materials into a standard taxonomy.

**Minimum viable classification:** map each `material_group` code to a category name manually or via a lookup table. Every PO line then carries a `category_id` field usable for groupby breakdowns.

**Fuller classification** (multi-signal cascade) is documented separately — not required for this KPI engine to work.

---

# Part 8 — The 8 KPI Calculations

Each KPI: **Question → Required columns → Formula → Outlier handling → Availability rules → Output shape → Benchmark band.**

---

## KPI 1 — TAT (PR-to-PO Turnaround, days)

**Question:** how long from PR release/creation to PO creation, on average?

**Required columns:**
- PO: `po_number`, `po_creation_date`
- PR: `pr_number` + at least one of `pr_release_date` (preferred) or `pr_creation_date`

**Formula:**

```
Step 1 — Dedupe on po_number (multi-line POs count as one PO):
    grouped = df.groupby('po_number').agg(
        po_dt = ('po_creation_date', 'min'),
        pr_dt = ('pr_release_date',  'min'),
    )

Step 2 — Compute TAT in days:
    grouped['tat_days'] = (grouped['po_dt'] - grouped['pr_dt']).days

Step 3 — Drop non-positive TATs (data errors):
    positive = grouped[grouped['tat_days'] > 0]

Step 4 — IQR upper-fence outlier removal (Tukey):
    Q1, Q3 = positive['tat_days'].quantile([0.25, 0.75])
    fence  = Q3 + 1.5 × (Q3 - Q1)
    trimmed = positive[positive['tat_days'] <= fence]

    Rule: if len(positive) < 10, skip trim (too few rows for reliable IQR).

Step 5 — Report the mean of trimmed:
    tat = round(trimmed['tat_days'].mean(), 1)
```

**Outlier philosophy:** ONLY upper fence. Fast TATs are real. Slow outliers are usually date-matching errors (e.g. re-opened PR from 3 years ago paired to recent PO → 800-day TAT skews the mean).

**Availability:** unavailable if `po_number`, `po_creation_date`, or both PR-date columns are missing, OR fewer than 1 row survives filters.

**Benchmark band:** 7-21 days. <7 = best-in-class. >21 = process gap.

---

## KPI 2 — Savings over LPO %

**Question:** how much did the average price per material fall vs the previous purchase?

**Required columns:**
- PO: `net_price`, `po_creation_date`
- Preferred: `material_number` (per-material path)

**Formula — Per-material, volume-weighted (sharper method):**

```
Step 1 — Group PO lines by (material, month):
    per_mat_monthly = df.groupby(['material_number', month]).agg(
        avg_price = ('net_price', 'mean')
    )

Step 2 — Keep materials with >=2 months of history:
    eligible = materials with 2+ monthly avg prices

Step 3 — Per material: latest vs prior month:
    for each eligible material:
        prior_p  = second-to-last month's avg_price
        latest_p = last month's avg_price
        if prior_p == 0: skip
        savings_pct = (prior_p - latest_p) / prior_p

Step 4 — Volume-weight by material spend in last 6 months:
    weight_per_mat = sum(net_price × quantity) for material in last 6 months
    portfolio_savings_pct =
        Σ(per_material_savings_pct × weight_per_mat) / Σ(weight_per_mat)

Step 5 — Multiply by 100 for display:
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

**Sanity flag:** if `|savings| > 50%`, surface a warning — likely insufficient per-material history or synthetic data. Real sustained sourcing savings rarely exceed ±15%.

**Availability:** unavailable if no `net_price`, no `po_creation_date`, or fewer than 2 months of positive-price data.

**Benchmark band:** 2-6%. >6% sustained = mature category sourcing. <2% = price-taker.

---

## KPI 3 — RC Adoption %

**Question:** what % of PO lines are against active rate contracts (RC / OLA / framework), vs spot purchases?

**Required columns:** any of `contract_number`, `outline_agreement`, `scheduling_agreement`. Fallback: `po_type`.

**Formula (Method 1 — Agreement columns):**

```
Step 1 — 12-value exclusion list (case-insensitive):
    excluded = {"non arc", "non-arc", "no", "none", "n/a", "na", "0",
                "no contract", "spot", "open po", "non-rc", "nonrc", "non rc"}

Step 2 — For each row, check ANY of the three columns:
    has_contract = False
    for col in [contract_number, outline_agreement, scheduling_agreement]:
        if col in df.columns:
            v = df[col].astype(str).strip().lower()
            col_has = (v is not null AND v != '' AND v != 'nan'
                       AND v NOT IN excluded)
            has_contract |= col_has

Step 3 — Compute rate:
    rc_adoption = round(has_contract.sum() / total_rows × 100, 1)
```

**Formula (Method 2 — Fallback via PO Type):**

Only when no agreement column populated. SAP `BSART` code mapping:
- **RC types (count as contracted):** LP, LPA, WK, MK, KA, RC, blanket, framework
- **Spot types (not counted):** NB (standard), anything else

**Why the exclusion list matters:** real client data has placeholder text like `"Non ARC"`, `"n/a"`, `"None"`, `"0"` in contract fields. Without exclusion, these count as "has a contract" and inflate the metric.

**Outlier handling:** none.

**Availability:** unavailable if NONE of the three columns exist.

**Data quality mode:** `any_of` — coverage_pct = rows where at least one of the three columns is populated. Missing all three ≠ 0% RC adoption — the metric is genuinely unavailable.

**Benchmark band:** 35-55%. >55% = strong sourcing maturity. <35% = tail exposure.

---

## KPI 4 — PAC / Single-Vendor PRs %

**Question:** what % of unique POs are Proprietary Article Certificate (PAC) / single-source?

**Required columns:**
- `po_number` (always)
- Any PAC flag column OR text columns for keyword scan

**PAC flag columns (priority order — first found wins):**
```
pac_flag  →  pac_pr  →  pac  →  single_source_flag  →  PAC_Flag  →  PAC
```

**Yes-values accepted for flag (case-insensitive, whitespace-stripped):**
```
yes, y, true, "1", pac, "single source", "sole source"
```

**Text scan (fallback / additional):**

Columns scanned: `short_text`, `pr_text`, `remarks`, `reason`

Keywords (uppercase, exact substring):
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

**Why PO-level not line-level:** a 10-line PO with 1 PAC line should count as 1 PAC PO, not "10% PAC lines". PAC is a PO-level decision.

**Outlier handling:** none.

**Availability:** unavailable if no `po_number`. Zero-value if `po_number` present but no flag or text hits (interpreted as "0% PAC", not unavailable).

**Benchmark band:** 8-20%. >20% = competition risk. <8% = best-in-class diversification.

---

## KPI 5 — Tail Spend %

**Question:** what % of PO lines are below ₹1 Lakh in value?

**Required columns:** `net_value` (or `net_value_inr` if normalised upstream).

**Fixed threshold:** ₹1,00,000 (₹1 Lakh) per PO line. **Not configurable.**

**Formula:**

```
Step 1 — Detect unit (INR vs Crore vs already-normalised):
    if column name contains 'cr' or 'crore':
        values are in Crore → multiply by 1e7 first
    elif median of positive values < 10:
        likely Crore → multiply by 1e7
    else:
        already in raw INR

Step 2 — Count lines below threshold:
    tail_pct = round((s < 100000).sum() / len(s) × 100, 1)
```

**Why line-count not spend-value:** the metric measures **transactional drag** — how many small POs consume buyer time. 40% tail = 40% of lines could be moved to catalogue/OLA.

**Outlier handling:** implicit via unit detection. No explicit trimming.

**Availability:** unavailable if no `net_value` column or all values NaN.

**Benchmark band:** 35-55%. >55% = excessive transactional drag. <35% = strong consolidation.

---

## KPI 6 — Spend per FTE (₹ Cr/FTE)

**Question:** how much addressable spend does each procurement FTE manage?

**Required inputs:**
- PO: `net_value`
- External: `fte_count` (procurement FTE only, not enterprise headcount)

**Formula:**

```
Step 1 — Sum-based unit detection:
    total = sum(pd.to_numeric(net_value, errors='coerce'))

    if total >= 1e7:   # raw INR
        cr = total / 1e7
    elif total >= 1e5: # thousands
        cr = total / 1e5
    else:              # already Crore
        cr = total

Step 2 — Divide by FTE count:
    spend_per_fte = round(cr / fte_count, 2)
```

**Why sum-based unit detection (not median or max):**
- **Median fails** when many small line items drag median below ₹1 Lakh even though total is ₹400 Cr+
- **Max fails** when no single line exceeds ₹1 Cr even though total is hundreds of Crore
- **Sum is the only reliable signal at portfolio scale**

**Preprocessing:** strip commas from string values before summing (`"1,23,456"` → `123456`).

**Outlier handling:** none. Use all active rows.

**Availability:** unavailable if `fte_count` is 0/null OR no `net_value` column.

**Benchmark band:** 75-175 ₹ Cr/FTE. >175 = lean operations. <75 = over-staffing or low automation.

---

## KPI 7 — On-Time Delivery %

**Question:** what % of deliveries arrived on or before the promised date?

**Required columns:** `delivery_date`, `gr_date`.

**Formula:**

```
Step 1 — Denominator = only POs that have BOTH dates populated:
    dfx = df.dropna(subset=['delivery_date', 'gr_date'])
    (Undelivered / open POs excluded entirely.)

Step 2 — Parse both as dates:
    delivery_date and gr_date → datetime
    Drop rows where either failed to parse

Step 3 — Strict comparison (no grace period):
    on_time = gr_date <= delivery_date
    # NOT + 1_day, NOT + 3_days

Step 4 — Optional strictness bump (when quantity data present):
    Full delivery required. If gr_quantity < po_quantity, NOT on-time
    even if the GR date was on time. Partial = not on-time.

Step 5 — Compute rate:
    otd = round(on_time.sum() / len(dfx) × 100, 1)
```

**Outlier handling:** none.

**Availability:** unavailable if either date column is missing, or no rows have both.

**Benchmark band:** 75-92%. >92% = best-in-class. <75% = supplier reliability gap.

---

## KPI 8 — Sourcing Tool Usage %

**Question:** what % of sourcing events run through an e-sourcing platform (vs email / Excel / paper)?

**V1 — QRE-derived proxy** (until real ERP e-sourcing integration):

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

Requires the e-sourcing platform (Ariba, Coupa, Bidder360 etc.) to expose RFQ data via API or export.

**Outlier handling:** none.

**Availability:** unavailable if QRE not answered AND no ERP integration.

**Benchmark band:** 30-65%. >65% = mature digital sourcing. <30% = paper/email-driven.

---

# Part 9 — Outlier Philosophy

## Principle 1 — Upper fence only

When trimming, only apply the upper Tukey fence: `Q3 + 1.5 × IQR`. Never trim the lower fence.

**Rationale:** in procurement KPIs, "fast" and "good" values are almost always real performance. Extreme slow / bad tails are usually data quality issues (matching errors, unit mismatches, synthetic seed data).

- **TAT:** 0.5-day TAT is real (auto-conversion). 800-day TAT is a matching error.
- **Savings:** 20% is real (renegotiation win). 90% is a missing decimal / synthetic price.
- **RC Adoption / OTD / PAC / Tail:** all bounded 0-100%. No trimming.

## Principle 2 — Minimum rows before trimming

If < **10 rows** remain after basic cleanup (non-null, positive), skip IQR trimming entirely. IQR statistics on <10 points produce unreliable fences.

## Principle 3 — Never silently drop good data

When trimming, log:
- Count before trim
- Count after trim
- Fence value used
- Sample rows just outside the fence (for consultant review)

Consultant can override the trim if they know the extreme values are real.

## Principle 4 — Sanity flags over silent capping

For metrics with expected ranges (Savings ±15%), surface a ⚠ warning when outside range. Don't silently cap — let the consultant decide.

---

# Part 10 — Time Period Rules

## 10.1 Scope lookback window

Set at engagement/analysis level. Default: **18 months**.

```
cutoff_date = today - lookback_months × 30 days
```

Rows with `po_creation_date < cutoff_date` are dropped from all analyses. Log the drop count.

Guidance:
- **12 months minimum** — for meaningful trend
- **18 months** — default, 2 fiscal year comparison
- **24 months** — deeper history; ERP data quality often degrades further back
- **36 months** — only for pre- vs post-transformation comparisons

## 10.2 Multi-sheet FY tabs

When the workbook has FY22 / FY23 / FY24 tabs, all rows concatenated with `_source_sheet` column. Lookback still applies globally — an FY22 tab won't survive if older than the cutoff.

## 10.3 Per-month rolling (for trend view)

For per-month breakdown (trend charts):

```
Step 1 — Group by po_creation_date.dt.to_period('M')
Step 2 — Apply same IQR-trim per month (min 10 rows rule still applies)
Step 3 — Report KPI value per month
```

## 10.4 Savings — 2 months minimum

Savings over LPO requires at least 2 calendar months of `po_creation_date` data. Fewer → unavailable.

## 10.5 Volume-weighted last-6-months

Per-material savings weighting uses the last 6 months to compute material weight. Rationale: recent buying reflects current addressable spend, not history.

---

# Part 11 — Category Breakdowns (per-KPI slicing)

Every KPI is computed at 3 levels:

1. **Headline** — one number for the whole dataset
2. **Per category** — the KPI recomputed on each category subset (e.g. Iron Ore's TAT vs Bearings' TAT)
3. **Per archetype** (optional, if archetype classification present) — BULK / DIRECT / INDIRECT / SERVICE / CAPEX

For each breakdown row:
```
{
  category_id: "iron_ore",
  category_label: "Iron Ore",
  archetype: "BULK",         // optional
  value: 6.8,                // KPI value on this subset
  row_count: 42
}
```

**Rules:**
- Subsets with fewer than 5 rows → still show, mark low-confidence
- Subsets with 0 rows → don't appear
- Uncategorised rows → surface separately (useful data-quality signal)

**No classification available?** Skip breakdowns entirely; the headline KPI still works.

---

# Part 12 — Data Quality Reporting (per KPI)

Every KPI carries a `data_quality` block:

```
{
  required_cols: ["po_number", "po_creation_date", "pr_release_date"],
  mode: "all_of",              // or "any_of" for RC Adoption
  missing_cols: [],
  rows_available: 500,         // total rows in dataset
  rows_used: 462,              // rows where all required_cols populated
  coverage_pct: 92.4,          // rows_used / rows_available
  per_column_completeness_pct: {
    "po_number": 100.0,
    "po_creation_date": 100.0,
    "pr_release_date": 92.4
  }
}
```

**Modes:**
- **`all_of`** (default) — rows_used = rows where every required column populated. Applies to TAT, OTD, Savings, Spend/FTE.
- **`any_of`** — rows_used = rows where at least one required column populated. Applies to RC Adoption (any of 3 contract columns).

**Consultant surfacing:** "Coverage: 92.4% (462 of 500 rows had all required fields)". Values below 80% get a ⚠ badge.

---

# Part 13 — Benchmark Bands

Every KPI has a typical band (representative benchmark; refresh per your industry). UI shows: `your X vs typical [low, high]` with directional cue.

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

**Position classification:**
- **`within_typical`** — neutral badge
- **`above_typical_good`** / **`below_typical_good`** — green (good side)
- **`above_typical_bad`** / **`below_typical`** — amber/red (bad side)

**Direction logic:**
- `higher_is_better`: value < low → below_typical (bad); value > high → above_typical_good; else within
- `lower_is_better`: value > high → above_typical_bad; value < low → below_typical_good; else within

---

# Part 14 — Dashboard Layout & Representation

Pure KPI focus — no pillar organisation, no maturity gauges. Just the 8 KPIs.

## 14.1 Page structure

```
┌───────────────────────────────────────────────────────────────────┐
│ HEADER                                                            │
│   Client · Industry · Period · Data upload timestamp              │
├───────────────────────────────────────────────────────────────────┤
│ DATA QUALITY STRIP                                                │
│   Rows: 500 · Classified: 92% · Uncat: 8% · Lookback: 18mo       │
├───────────────────────────────────────────────────────────────────┤
│ PORTFOLIO HERO (context bar)                                      │
│   Total spend  ₹2,140 Cr    PO count  500      Vendors  92        │
│   Plants  4                 FYs  FY22–FY24                        │
├───────────────────────────────────────────────────────────────────┤
│ FILTER CHIP BAR                                                   │
│   [ Plants ▼ ]  [ Categories ▼ ]  [ FY tabs ▼ ]  [ Period ▼ ]   │
│   [ Apply ]                          Re-runs engine on subset    │
├───────────────────────────────────────────────────────────────────┤
│ TOP BAR                                                           │
│   [Search 🔍]  [Sort: Name/Value ▼]  [View: Grid|List|Trend]     │
├───────────────────────────────────────────────────────────────────┤
│ KPI GRID (default view)                                           │
│                                                                   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │
│  │   TAT     │  │  Savings  │  │  RC Adopt │  │    PAC    │     │
│  │  14.3 d   │  │   3.2 %   │  │   42 %    │  │   12 %    │     │
│  │  ↓ better │  │  ↑ better │  │  ↑ better │  │  ↓ better │     │
│  │  ├──●──┤  │  │  ├●────┤  │  │  ├──●──┤  │  │  ├──●──┤  │     │
│  │  7  21    │  │  2  6     │  │  35 55    │  │  8  20    │     │
│  │  92% DQ ● │  │  100% DQ ●│  │  100% DQ ●│  │  84% DQ ● │     │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │
│                                                                   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │
│  │Tail Spend │  │ Spend/FTE │  │    OTD    │  │Sourcing   │     │
│  │   38 %    │  │  ₹94 Cr   │  │   82 %    │  │   65 %    │     │
│  │  ↓ better │  │  ↑ better │  │  ↑ better │  │  ↑ better │     │
│  │  ├──●──┤  │  │  ├──●──┤  │  │  ├────●┤  │  │  ├─────●┤ │     │
│  │  35 55    │  │  75 175   │  │  75 92    │  │  30 65    │     │
│  │  100% DQ ●│  │  100% DQ ●│  │  47% DQ ● │  │  100% DQ ●│     │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │
└───────────────────────────────────────────────────────────────────┘

Click any card → DRAWER opens with drill-down:
  ┌────────────────────────────────────────────────────────────┐
  │ TAT (PR-to-PO, days) — 14.3 days                           │
  │                                                            │
  │ Benchmark: 7–21 days · Position: within typical            │
  │                                                            │
  │ Formula walkthrough (actual numbers):                      │
  │   500 rows → 462 with all required fields                  │
  │   462 → 448 after dropping non-positive TATs               │
  │   IQR fence: 45.8 days → 12 rows above fence dropped       │
  │   Final mean of 436 rows: 14.3 days                        │
  │                                                            │
  │ Per category:                                              │
  │   Iron Ore          6.8 d   (42 rows)                      │
  │   Coking Coal      12.1 d   (28 rows)                      │
  │   Ferro Alloys     18.4 d   (47 rows)                      │
  │   ...                                                      │
  │                                                            │
  │ Per archetype:                                             │
  │   BULK      10.2 d  (192 rows)                             │
  │   DIRECT    13.7 d  (140 rows)                             │
  │   INDIRECT  22.1 d  ( 98 rows)                             │
  │                                                            │
  │ Data quality: 92.4% coverage                               │
  │   po_number:         100%                                  │
  │   po_creation_date:  100%                                  │
  │   pr_release_date:    92.4%                                │
  │                                                            │
  │ Trend (last 12 months):                                    │
  │   ▁▂▃▂▂▄▃▂▃▄▅▄  ← spark bar per month                     │
  └────────────────────────────────────────────────────────────┘
```

## 14.2 KPI card design

Each card shows:
- KPI name + unit (e.g. `TAT (PR-to-PO, days)`)
- **Value** (large, prominent — e.g. `14.3`)
- **Direction indicator** (small arrow showing higher/lower is better)
- **Benchmark bar** — horizontal mini-bar with the client's position marked (●) between typical low and high
- **Data quality badge** — coloured dot: green ≥ 90% · amber 70-90% · red < 70%
- Click → opens drawer

## 14.3 Three view modes

- **Grid** (default) — visual cards, best for scanning
- **List** — dense sortable table (KPI · Value · Benchmark · Coverage) — best for cross-comparison and export
- **Trend** — 3- to 12-month rolling sparklines per KPI — best for spotting deterioration or improvement

## 14.4 Filter chip bar (page-level drill-down)

Lets the consultant re-run all KPIs against a subset of the data:
- **Plants** — multi-select
- **Categories** — multi-select from category taxonomy
- **FY tabs** — multi-select from `_source_sheet` values
- **Period** — calendar range within the lookback window

When filters applied, backend re-runs the whole KPI pipeline on the subset in 2-5 seconds. Dashboard stays visible with a "recomputing" badge; results replace live.

## 14.5 Search + sort

- **Search box** — filters KPI list by name
- **Sort** — Name / Value / Data-quality coverage

## 14.6 Colour + directional cues

- **Green** = better than benchmark
- **Amber** = within benchmark
- **Red** = worse than benchmark
- **Grey** = data not available

Never rely on colour alone — pair with icons (↑ / ↓ / ⚠) for accessibility.

## 14.7 Export

Every KPI card + drill-down drawer should export to:
- **CSV** — the KPI value + breakdowns as tables (for further analysis)
- **PPT / PDF** — the full dashboard as slides / report
- **PNG** — individual charts

---

# Part 15 — Output Data Contract

Shape for a downstream tool consuming the KPI engine:

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
      "per_category": [
        { "category_id": "iron_ore", "category_label": "Iron Ore", "archetype": "BULK", "value": 6.8, "row_count": 42 }
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
          "po_number": 100.0,
          "po_creation_date": 100.0,
          "pr_release_date": 92.4
        }
      },
      "benchmark": {
        "typical_low": 7,
        "typical_high": 21,
        "unit": "days",
        "direction": "lower_is_better",
        "your_position": "within_typical",
        "note": "Median PR-to-PO TAT across Indian steel/cement engagements."
      },
      "trend_monthly": [
        { "month": "2023-01", "value": 16.2, "row_count": 22 },
        { "month": "2023-02", "value": 14.8, "row_count": 26 }
      ]
    }
    // ... 7 more KPI objects, same shape
  ]
}
```

---

# Appendix A — How to apply this manually (no tool)

1. Get PO + PR Excel dumps from the client.
2. Combine sheets if multi-tab (Part 5). Add `_source_sheet` column.
3. Run cleansing (Part 6) end-to-end.
4. Confirm column mapping (Part 4). Fill obvious gaps manually.
5. (Optional) Classify materials into a category taxonomy (Part 7).
6. For each of the 8 KPIs:
   - Check required columns present (Part 8)
   - Apply formula (Part 8)
   - Apply outlier trim if applicable (Parts 7 + 8)
   - Compute breakdown per category / archetype (Part 11) if classification present
   - Compute data-quality block (Part 12)
   - Compare to benchmark (Part 13)
7. Assemble into the output structure (Part 15).
8. Present per dashboard layout (Part 14).

Total effort for a 500-row PO dump + PR dump: **~3 hours in Excel/pandas** for a first pass.

---

# Appendix B — Common failure modes to guard against

| Symptom | Root cause | Fix |
|---|---|---|
| All spend appears as ₹0 | Commas in `Net Value` column not stripped before numeric coerce | Strip commas before `pd.to_numeric` |
| Tail Spend = 100% | Values in ₹Cr but unit detection failed | Check column-name hints, median-based detection, or sum-based |
| TAT = 400 days | Untrimmed outliers from date matching errors | Ensure IQR upper-fence trim is applied |
| RC Adoption = 100% | Contract column has junk text like `"Non ARC"` not being excluded | Extend the 12-value exclusion list |
| Savings = 89% | Insufficient per-material history OR synthetic prices | Surface as ⚠ warning; don't silently show |
| OTD = 0% | `delivery_date` never populated in source PO dump | Mark KPI unavailable |
| Spend/FTE = 0.03 Cr | `fte_count` interpreted as enterprise headcount, not procurement FTE | Confirm with client — procurement FTE only |
| PAC = 40% | Text scan matching `PAC` inside longer words | Use `str.upper().contains("PAC")` with word boundaries or explicit token match |
| PR-to-PO join yields 0 rows | `PR Number` in PR file has leading zeros stripped by Excel | Force both join keys to string, strip whitespace, cast dtype |
| Multi-sheet reader silently dropped a real sheet | Cover-page heuristic too aggressive | Review the excluded sheets panel; consultant can override |
| Schema drift across FY tabs | New column added mid-year (e.g. `EXTWG` in FY24 only) | pandas NaN-pads; surface as `schema_drift` warning |

---

# Appendix C — Configurable knobs

Everything a consultant might tune per engagement:

| Knob | Default | Location in this spec |
|---|---|---|
| Lookback months | 18 | Part 6.6 / Part 10.1 |
| RC exclusion list | 12 values | Part 8 KPI 3 |
| Tail spend threshold | ₹1,00,000 per line | Part 8 KPI 5 |
| IQR trim multiplier | 1.5 | Part 8 KPI 1, Part 9 |
| Minimum rows for IQR trim | 10 | Part 9 Principle 2 |
| Savings sanity flag threshold | ±50% | Part 8 KPI 2 |
| Data-quality warn threshold | < 80% coverage | Part 12 |
| Benchmark bands per KPI | see Part 13 | Part 13 |
| FX rates per currency | see Part 6.3 | Part 6.3 |
| Cover-page heuristic | ≤ 2 cols + sparse first row | Part 5 |

Store these in a config file (YAML / JSON / DB) rather than hard-coding. Consultant edits per engagement.

---

**Version:** 1.0 — pure KPI focus, no pillar dependencies.
