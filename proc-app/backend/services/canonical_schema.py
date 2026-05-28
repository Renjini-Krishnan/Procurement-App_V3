"""Canonical schema definitions per data file type.

For V1 these are inlined here. In Build 2 they move to
data-templates/<file>.yml so the consultant can edit via the KB editor.

Each canonical field has:
  - field: the canonical name the engine uses internally
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
    "fields": [
        {
            "field": "po_number",
            "aliases": ["PO Number", "PO_Number", "Pur.Order Number", "EBELN", "Document Number", "PurchaseOrderNo"],
            "type": "string",
            "required": True,
            "description": "Unique PO document number.",
        },
        {
            "field": "po_item",
            "aliases": ["PO Item", "PO_Item", "Item", "EBELP", "Line Item"],
            "type": "integer",
            "required": True,
            "description": "Line item number within the PO.",
        },
        {
            "field": "po_creation_date",
            "aliases": ["PO Creation Date", "PO Date", "PO Doc. Date", "PO Doc Date", "PO Document Date", "Document Date", "Doc Date", "BEDAT", "PO_Date", "Created On"],
            "type": "date",
            "required": True,
            "description": "Date the PO was created.",
        },
        {
            "field": "material_group",
            "aliases": ["Material Group", "Mat.Group", "MATKL", "MG Code", "Commodity Code"],
            "type": "string",
            "required": True,
            "description": "Material group / commodity code — the primary classification key.",
        },
        {
            "field": "material_group_desc",
            "aliases": ["Material Group Description", "Mat.Group.1", "MG Description", "Material_Group_Desc", "Commodity Description"],
            "type": "string",
            "required": True,
            "description": "Free-text description of the material group.",
        },
        {
            "field": "net_value",
            "aliases": ["Net Value", "Net Order Value", "NETWR", "PO Value", "Amount", "Line Value"],
            "type": "number",
            "required": True,
            "description": "Line-item value (in PO currency).",
        },
        {
            "field": "currency",
            "aliases": ["Currency", "Curr", "WAERS"],
            "type": "string",
            "required": False,
            "description": "Currency code (ISO 4217). Defaults to engagement currency if blank.",
        },
        {
            "field": "vendor_id",
            "aliases": ["Vendor", "Vendor ID", "Vendor No", "LIFNR", "Vendor Number"],
            "type": "string",
            "required": True,
            "description": "Unique vendor identifier.",
        },
        {
            "field": "vendor_name",
            "aliases": ["Vendor Name", "NAME1", "Supplier Name"],
            "type": "string",
            "required": True,
            "description": "Vendor display name.",
        },
        {
            "field": "plant",
            "aliases": ["Plant", "Plant Code", "WERKS", "Plant_Code"],
            "type": "string",
            "required": True,
            "description": "Receiving plant code.",
        },
        {
            "field": "purchase_group",
            "aliases": ["Purchase Group", "Purch. Group", "EKGRP", "Buyer Group", "PurchGrp"],
            "type": "string",
            "required": False,
            "description": "Buyer / purchase group code.",
        },
        {
            "field": "cost_center",
            "aliases": ["Cost Center", "Cost Centre", "KOSTL", "CC"],
            "type": "string",
            "required": False,
            "description": "Cost centre to which the PO is charged.",
        },
        {
            "field": "short_text",
            "aliases": ["Short Text", "Item Description", "TXZ01", "Item Short Text"],
            "type": "string",
            "required": False,
            "description": "Free-text short description of the line item.",
        },
        {
            "field": "contract_number",
            "aliases": ["Contract Number", "Agreement Number", "KONNR", "Contract Ref"],
            "type": "string",
            "required": False,
            "description": "Reference to long-term rate contract / ARC.",
        },
        {
            "field": "outline_agreement",
            "aliases": ["Outline Agreement", "OLA Number", "Blanket PO", "OLA Ref"],
            "type": "string",
            "required": False,
            "description": "Reference to annual blanket OLA.",
        },
        {
            "field": "scheduling_agreement",
            "aliases": ["Scheduling Agreement", "Sched Agreement", "Catalog Ref"],
            "type": "string",
            "required": False,
            "description": "Reference to scheduling agreement / catalogue item.",
        },
        {
            "field": "item_category",
            "aliases": ["Item Category", "Pstyp", "PSTYP", "Item Type"],
            "type": "string",
            "required": False,
            "description": "SAP PSTYP — A=Asset/CAPEX, D=Service.",
        },
        {
            "field": "material_type",
            "aliases": ["Material Type", "MTART", "Mat Type"],
            "type": "string",
            "required": False,
            "description": "SAP MTART — DIEN=Service, ANLZ=Asset, ERSA/NLAG=Spare/Non-stock.",
        },
        {
            "field": "quantity",
            "aliases": ["Quantity", "Qty", "MENGE", "Order Quantity"],
            "type": "number",
            "required": False,
            "description": "Order quantity.",
        },
        {
            "field": "uom",
            "aliases": ["UoM", "Unit", "MEINS", "Unit of Measure"],
            "type": "string",
            "required": False,
            "description": "Unit of measure.",
        },
    ],
}


SCHEMAS = {
    "PO": PO_SCHEMA,
}


def get_schema(file_type: str) -> dict:
    return SCHEMAS[file_type]


# --------------------------------------------------------------------------
# Column matcher — fuzzy maps raw column names → canonical field names
# --------------------------------------------------------------------------

def _normalise(s: str) -> str:
    return "".join(ch.lower() for ch in s if ch.isalnum())


def suggest_mapping(raw_columns: list[str], file_type: str) -> dict:
    """For each raw column, suggest a canonical field.

    Returns:
      {
        "matches": [
          {
            "raw_column": str,
            "suggested_field": str | None,
            "confidence": "high" | "medium" | "low" | "none",
            "match_reason": str,
          },
          ...
        ],
        "missing_required": [field_name, ...],
        "schema": {... file schema for the UI ...}
      }
    """
    schema = get_schema(file_type)
    canonical_index = {}   # normalised alias -> canonical field
    for f in schema["fields"]:
        canonical_index[_normalise(f["field"])] = (f["field"], "high", "canonical name match")
        for alias in f["aliases"]:
            canonical_index[_normalise(alias)] = (f["field"], "high", f"alias match: '{alias}'")

    matches = []
    matched_canonical = set()
    for col in raw_columns:
        norm = _normalise(col)
        suggested, confidence, reason = (None, "none", "no match")
        if norm in canonical_index:
            suggested, confidence, reason = canonical_index[norm]
        else:
            # Try substring contains
            for k, (field_name, _, _) in canonical_index.items():
                if k and (k in norm or norm in k):
                    suggested = field_name
                    confidence = "medium"
                    reason = f"substring match on '{k}'"
                    break
        if suggested:
            matched_canonical.add(suggested)
        matches.append({
            "raw_column": col,
            "suggested_field": suggested,
            "confidence": confidence,
            "match_reason": reason,
        })

    required_fields = {f["field"] for f in schema["fields"] if f["required"]}
    missing_required = sorted(required_fields - matched_canonical)

    return {
        "matches": matches,
        "missing_required": missing_required,
        "schema": schema,
    }
