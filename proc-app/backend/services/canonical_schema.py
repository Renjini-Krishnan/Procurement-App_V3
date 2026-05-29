"""Canonical schema definitions per data file type.

Aligned to the Accenture Client Pack v10 template — uses the exact column
names the client receives in the workbook + their SAP source columns +
common variants as aliases.

For V1 these are inlined here. In Build 2 they move to
data-templates/<file>.yml so the consultant can edit via the KB editor.

Each canonical field has:
  - field: the canonical name the engine uses internally (lowercase_snake)
  - aliases: list of common raw column names (fuzzy-match candidates)
  - type: expected dtype
  - required: whether the field blocks downstream analytics if missing
  - description: shown in the consultant column-mapping UI
"""
from __future__ import annotations

from typing import Optional

PO_SCHEMA = {
    "file_type": "PO",
    "label": "Purchase Order (PO) Dump",
    "source_template": "Accenture Client Pack v10",
    "fields": [
        {"field": "po_number",         "aliases": ["PO_Number", "PO Number", "Pur.Order Number", "EBELN"],         "type": "string",  "required": True,  "description": "Unique PO document number. SAP EKKO.EBELN."},
        {"field": "po_item",           "aliases": ["PO_Item", "PO Item", "Item", "EBELP", "Line Item"],            "type": "integer", "required": True,  "description": "PO line item number. SAP EKPO.EBELP."},
        {"field": "po_creation_date",  "aliases": ["PO_Creation_Date", "PO Creation Date", "PO Doc. Date", "BEDAT"], "type": "date",   "required": True,  "description": "Date PO was created. SAP EKKO.BEDAT."},
        {"field": "company_code",      "aliases": ["Company_Code", "Company Code", "BUKRS"],                       "type": "string",  "required": True,  "description": "Legal entity / company code. SAP EKKO.BUKRS."},
        {"field": "plant",             "aliases": ["Plant", "Plant Code", "WERKS"],                                "type": "string",  "required": True,  "description": "Receiving plant code. SAP EKPO.WERKS."},
        {"field": "purchase_group",    "aliases": ["Purchase_Group", "Purchase Group", "Purch. Group", "EKGRP"],   "type": "string",  "required": True,  "description": "Buyer group code. SAP EKKO.EKGRP."},
        {"field": "vendor_id",         "aliases": ["Vendor_Number", "Vendor Number", "Vendor", "LIFNR"],           "type": "string",  "required": True,  "description": "Unique supplier master ID. SAP LFA1.LIFNR."},
        {"field": "vendor_name",       "aliases": ["Vendor_Name", "Vendor Name", "NAME1", "Supplier Name"],        "type": "string",  "required": True,  "description": "Vendor name. SAP LFA1.NAME1."},
        {"field": "material_group",    "aliases": ["Material_Group", "Material Group", "Mat.Group", "MATKL"],      "type": "string",  "required": True,  "description": "Material group code (primary classification key). SAP EKPO.MATKL."},
        {"field": "material_group_desc", "aliases": ["Material_Group_Desc", "Material Group Description", "Mat.Group.1", "MG Description"], "type": "string", "required": False, "description": "Material group description (free text)."},
        {"field": "net_value",         "aliases": ["Net_Value", "Net Value", "Net Order Value", "NETWR"],          "type": "number",  "required": True,  "description": "Net order value (Qty × Net Price). SAP EKPO.NETWR."},
        {"field": "currency",          "aliases": ["Currency", "Curr", "WAERS"],                                    "type": "string",  "required": True,  "description": "Transaction currency (ISO 4217). SAP EKKO.WAERS."},
        {"field": "delivery_date",     "aliases": ["Delivery_Date", "Delivery Date", "EINDT"],                     "type": "date",    "required": True,  "description": "Scheduled delivery date. SAP EKPO.EINDT. Used for OTD."},
        {"field": "gr_date",           "aliases": ["GR_Date", "GR Date", "Goods Receipt Date"],                    "type": "date",    "required": True,  "description": "Actual goods-receipt date. SAP EKBE. Used for OTD, DPO."},
        {"field": "pr_reference",      "aliases": ["PR_Reference", "PR Reference", "BANFN"],                       "type": "string",  "required": True,  "description": "Source PR number. Critical for PR-to-PO TAT."},
        {"field": "contract_number",   "aliases": ["Contract_Number", "Contract Number", "Agreement Number", "KONNR"], "type": "string", "required": True, "description": "Linked rate contract / scheduling agreement."},
        {"field": "material_number",   "aliases": ["Material_Number", "Material Number", "MATNR"],                  "type": "string",  "required": True,  "description": "Material master number. Used for price comparison."},
        # Optional fields
        {"field": "po_type",           "aliases": ["PO_Type", "PO Type", "BSART"],                                 "type": "string",  "required": False, "description": "PO document type (NB=standard, FO=framework, UB=transfer)."},
        {"field": "net_price",         "aliases": ["Net_Price", "Net Price", "Net_Price_Per_Unit", "NETPR"],       "type": "number",  "required": False, "description": "Unit net price. Used for LPO savings analysis."},
        {"field": "quantity",          "aliases": ["Quantity", "Qty", "MENGE"],                                     "type": "number",  "required": False, "description": "Order quantity. SAP EKPO.MENGE."},
        {"field": "gr_quantity",       "aliases": ["GR_Quantity", "GR Quantity"],                                  "type": "number",  "required": False, "description": "Quantity received."},
        {"field": "gr_value",          "aliases": ["GR_Value", "GR Value"],                                        "type": "number",  "required": False, "description": "Value of goods received."},
        {"field": "invoice_date",      "aliases": ["Invoice_Date", "Invoice Date"],                                "type": "date",    "required": False, "description": "Invoice posting date. Used for DPO."},
        {"field": "invoice_value",     "aliases": ["Invoice_Value", "Invoice Value"],                              "type": "number",  "required": False, "description": "Invoice value against this PO line."},
        {"field": "outline_agreement", "aliases": ["Outline_Agreement", "Outline Agreement", "Framework Agreement"], "type": "string", "required": False, "description": "Framework agreement / blanket PO reference."},
        {"field": "vendor_evaluation_score", "aliases": ["Vendor_Evaluation_Score", "ME6H"],                        "type": "number",  "required": False, "description": "Vendor performance score from ERP evaluation."},
        # Additional fields useful for analyses (not in Client Pack but commonly available)
        {"field": "short_text",        "aliases": ["Short_Text", "Short Text", "Item Description", "TXZ01"],       "type": "string",  "required": False, "description": "Free-text line description."},
        {"field": "scheduling_agreement", "aliases": ["Scheduling_Agreement", "Scheduling Agreement"],             "type": "string",  "required": False, "description": "Scheduling agreement / catalogue item ref."},
        {"field": "item_category",     "aliases": ["Item_Category", "Item Category", "Pstyp", "PSTYP"],            "type": "string",  "required": False, "description": "SAP PSTYP — A=Asset/CAPEX, D=Service."},
        {"field": "material_type",     "aliases": ["Material_Type", "Material Type", "MTART"],                     "type": "string",  "required": False, "description": "SAP MTART — DIEN=Service, ANLZ=Asset, ERSA=Spare."},
        {"field": "cost_center",       "aliases": ["Cost_Center", "Cost Center", "KOSTL"],                         "type": "string",  "required": False, "description": "Cost centre."},
        {"field": "uom",               "aliases": ["UoM", "Unit", "MEINS"],                                         "type": "string",  "required": False, "description": "Unit of measure."},
    ],
}


PR_SCHEMA = {
    "file_type": "PR",
    "label": "Purchase Requisition (PR) Dump",
    "source_template": "Accenture Client Pack v10",
    "fields": [
        {"field": "pr_number",         "aliases": ["PR_Number", "PR Number", "BANFN"],                              "type": "string",  "required": True,  "description": "Unique PR document number. Join key to PO."},
        {"field": "pr_item",           "aliases": ["PR_Item", "PR Item"],                                           "type": "integer", "required": True,  "description": "PR line item number."},
        {"field": "pr_creation_date",  "aliases": ["PR_Creation_Date", "PR Creation Date"],                         "type": "date",    "required": True,  "description": "Date the PR was raised."},
        {"field": "plant",             "aliases": ["Plant", "Plant Code"],                                          "type": "string",  "required": True,  "description": "Requesting plant."},
        {"field": "purchase_group",    "aliases": ["Purchase_Group", "Purchase Group", "Purch. Group"],             "type": "string",  "required": True,  "description": "Assigned buyer group."},
        {"field": "material_group",    "aliases": ["Material_Group", "Material Group", "MATKL"],                    "type": "string",  "required": True,  "description": "Material group code."},
        {"field": "pr_release_date",   "aliases": ["PR_Release_Date", "PR Release Date"],                           "type": "date",    "required": True,  "description": "Date the PR was approved / released."},
        # Optional fields
        {"field": "pr_requisitioner",  "aliases": ["PR_Requisitioner_Name", "Requisitioner", "PR_Requestor"],       "type": "string",  "required": False, "description": "Person who raised the PR."},
        {"field": "pr_total_value",    "aliases": ["PR_Total_Value", "PR Total Value"],                             "type": "number",  "required": False, "description": "Total estimated PR value."},
        {"field": "delivery_date",     "aliases": ["Delivery_Date", "Required Date"],                                "type": "date",    "required": False, "description": "Required delivery date."},
        {"field": "pr_approver",       "aliases": ["PR_Approver", "PR Approver", "Approver"],                       "type": "string",  "required": False, "description": "Final approver name/ID. Used for DoA compliance."},
    ],
}


# Schemas now live as YAML in proc-app/kb/_meta/data-templates/<lowercase>.yml
# This makes them editable via the in-app KB editor. The Python constants above
# remain as fallbacks if a YAML file is missing.

import yaml
from pathlib import Path
from .. import config as _config

_TEMPLATE_DIR = _config.REPO_ROOT / "proc-app" / "kb" / "_meta" / "data-templates"

_FALLBACK_SCHEMAS = {
    "PO": PO_SCHEMA,
    "PR": PR_SCHEMA,
}

_FILE_NAME_BY_TYPE = {
    "PO": "po.yml",
    "PR": "pr.yml",
    "VENDOR_MASTER": "vendor_master.yml",
    "MATERIAL_MASTER": "material_master.yml",
    "ORG_STRUCTURE": "org_structure.yml",
    "CONTRACT_MASTER": "contract_master.yml",
    "GRN": "grn.yml",
    "INVOICE": "invoice.yml",
}

_schema_cache: dict[str, dict] = {}


def get_schema(file_type: str) -> dict:
    """Load a canonical schema. Prefers YAML in data-templates/; falls back
    to inlined Python constants for PO + PR if the YAML is absent."""
    key = file_type.upper()
    if key in _schema_cache:
        return _schema_cache[key]
    yml_name = _FILE_NAME_BY_TYPE.get(key)
    if yml_name:
        path = _TEMPLATE_DIR / yml_name
        if path.exists():
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            if data and "fields" in data:
                _schema_cache[key] = data
                return data
    if key in _FALLBACK_SCHEMAS:
        _schema_cache[key] = _FALLBACK_SCHEMAS[key]
        return _FALLBACK_SCHEMAS[key]
    raise KeyError(f"No canonical schema for file_type={file_type}")


def list_schema_types() -> list[dict]:
    """Used by the Upload UI to populate the file-type selector."""
    out = []
    for key, yml_name in _FILE_NAME_BY_TYPE.items():
        path = _TEMPLATE_DIR / yml_name
        if path.exists():
            try:
                data = yaml.safe_load(path.read_text(encoding="utf-8"))
                guidelines = data.get("guidelines") or {}
                out.append({
                    "file_type": key,
                    "label": data.get("label", key),
                    "yaml_path": f"_meta/data-templates/{yml_name}",
                    "field_count": len(data.get("fields", [])),
                    "required_count": sum(1 for f in data.get("fields", []) if f.get("required")),
                    "v1_status": guidelines.get("v1_status", "unknown"),
                    "v1_status_note": guidelines.get("v1_status_note", ""),
                })
            except Exception:
                pass
    return out


def invalidate_schema_cache():
    _schema_cache.clear()


SCHEMAS = _FALLBACK_SCHEMAS  # back-compat for any callers reading SCHEMAS dict


# --------------------------------------------------------------------------
# Column matcher — fuzzy maps raw column names → canonical field names
# --------------------------------------------------------------------------

def _normalise(s: str) -> str:
    return "".join(ch.lower() for ch in s if ch.isalnum())


def suggest_mapping(raw_columns: list[str], file_type: str) -> dict:
    """For each raw column, suggest a canonical field with 1:1 mapping.

    Returns:
      {
        "matches": [
          {"raw_column", "suggested_field", "confidence", "match_reason"},
          ...
        ],
        "missing_required": [field_name, ...],
        "schema": {... file schema for the UI ...}
      }
    """
    schema = get_schema(file_type)
    canonical_index = {}   # normalised alias -> (canonical, confidence, reason)
    for f in schema["fields"]:
        canonical_index[_normalise(f["field"])] = (f["field"], "high", "canonical name match")
        for alias in f["aliases"]:
            canonical_index[_normalise(alias)] = (f["field"], "high", f"alias match: '{alias}'")

    # Two passes:
    # Pass 1 — exact / alias matches (HIGH confidence). One winner per canonical.
    # Pass 2 — substring fallback (MEDIUM), only for canonical fields not yet matched.
    matched_canonical: dict[str, tuple] = {}
    matches: list[dict] = []
    pending_substring = []

    for col in raw_columns:
        norm = _normalise(col)
        if norm in canonical_index:
            field_name, conf, reason = canonical_index[norm]
            if field_name not in matched_canonical:
                matched_canonical[field_name] = (col, conf, reason)
                matches.append({
                    "raw_column": col, "suggested_field": field_name,
                    "confidence": conf, "match_reason": reason,
                })
                continue
        pending_substring.append((col, norm))

    for col, norm in pending_substring:
        suggested, confidence, reason = (None, "none", "no match")
        for k, (field_name, _, _) in canonical_index.items():
            if not k or field_name in matched_canonical:
                continue
            if k in norm or (len(norm) >= 4 and norm in k):
                suggested = field_name
                confidence = "medium"
                reason = f"substring match on '{k}'"
                matched_canonical[field_name] = (col, confidence, reason)
                break
        matches.append({
            "raw_column": col, "suggested_field": suggested,
            "confidence": confidence, "match_reason": reason,
        })

    by_col = {m["raw_column"]: m for m in matches}
    matches = [by_col[c] for c in raw_columns if c in by_col]

    # Optional LLM enrichment — opt-in via env (heuristic is excellent on seeds;
    # LLM mainly helps on noisy real-world client headers).
    import os
    if os.environ.get("PROCVAULT_LLM_COLMAP", "0") in ("1", "true", "yes"):
        try:
            from ..services import llm, llm_prompts
            prompt, fallback = llm_prompts.column_mapping(
                raw_columns=raw_columns, canonical_fields=schema["fields"],
                heuristic_mapping=matches, file_type=file_type,
            )
            llm_result = llm.generate_json(prompt, fallback)
            if isinstance(llm_result, list) and len(llm_result) == len(raw_columns):
                matches = [
                    {
                        "raw_column": m.get("raw_column", raw_columns[i]),
                        "suggested_field": m.get("suggested_field"),
                        "confidence": m.get("confidence", "low"),
                        "match_reason": m.get("reasoning", "LLM suggestion"),
                    }
                    for i, m in enumerate(llm_result)
                ]
        except Exception:
            pass  # keep heuristic matches

    required_fields = {f["field"] for f in schema["fields"] if f["required"]}
    mapped_canonical_set = {m["suggested_field"] for m in matches if m.get("suggested_field")}
    missing_required = sorted(required_fields - mapped_canonical_set)

    return {
        "matches": matches,
        "missing_required": missing_required,
        "schema": schema,
    }
