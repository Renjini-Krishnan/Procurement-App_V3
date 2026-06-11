"""Tests for the multi-sheet Excel reader in upload_service.

Covers: vertical concat, _source_sheet column, empty-sheet exclusion,
cover-page heuristic, schema-drift detection.
"""
from __future__ import annotations

import io

import pandas as pd
import pytest

from backend.services.upload_service import (
    SOURCE_SHEET_COL,
    _read_excel_multi_sheet,
    _read_excel_or_csv,
)


def _build_workbook(sheets: dict[str, pd.DataFrame]) -> io.BytesIO:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        for name, df in sheets.items():
            df.to_excel(w, sheet_name=name, index=False)
    buf.seek(0)
    return buf


def test_three_fy_tabs_combine_with_source_sheet_column():
    book = _build_workbook({
        "FY22": pd.DataFrame({"PO Number": ["A1", "A2"], "Net Value": [100, 200]}),
        "FY23": pd.DataFrame({"PO Number": ["B1", "B2", "B3"], "Net Value": [10, 20, 30]}),
        "FY24": pd.DataFrame({"PO Number": ["C1"], "Net Value": [99]}),
    })
    df, info, warnings = _read_excel_multi_sheet(book)
    assert len(df) == 6
    assert SOURCE_SHEET_COL in df.columns
    assert df.columns[0] == SOURCE_SHEET_COL  # pushed to front
    assert df[SOURCE_SHEET_COL].value_counts().to_dict() == {"FY22": 2, "FY23": 3, "FY24": 1}
    assert all(s["included"] for s in info)
    assert warnings == []


def test_empty_sheet_is_excluded():
    book = _build_workbook({
        "FY22": pd.DataFrame({"PO Number": ["A1"], "Net Value": [100]}),
        "FY23_empty": pd.DataFrame(columns=["PO Number", "Net Value"]),
    })
    df, info, _warnings = _read_excel_multi_sheet(book)
    assert len(df) == 1
    empty_info = next(s for s in info if s["sheet_name"] == "FY23_empty")
    assert empty_info["included"] is False
    assert empty_info["reason_excluded"] == "empty"


def test_cover_page_heuristic_excludes_single_column_sparse_sheet():
    book = _build_workbook({
        "Cover": pd.DataFrame({"Note": ["Confidential"]}),
        "FY22": pd.DataFrame({"PO Number": ["A1", "A2"], "Net Value": [1, 2]}),
    })
    df, info, _warnings = _read_excel_multi_sheet(book)
    assert len(df) == 2  # cover excluded
    cover_info = next(s for s in info if s["sheet_name"] == "Cover")
    assert cover_info["included"] is False
    assert cover_info["reason_excluded"] == "looks_like_cover_page"


def test_schema_drift_is_flagged_when_columns_differ():
    book = _build_workbook({
        "FY22": pd.DataFrame({"PO Number": ["A1"], "Plant": ["P1"], "Net Value": [100]}),
        # FY24 has an extra column (e.g. EXTWG was added mid-year)
        "FY24": pd.DataFrame({"PO Number": ["B1"], "Plant": ["P1"], "Net Value": [200],
                                  "External Material Group": ["EXT10"]}),
    })
    df, _info, warnings = _read_excel_multi_sheet(book)
    assert "schema_drift" in warnings
    # Union of columns; missing values NaN-padded by pandas
    assert "External Material Group" in df.columns
    # FY22 row should have NaN for the FY24-only column
    fy22 = df[df[SOURCE_SHEET_COL] == "FY22"]
    assert fy22["External Material Group"].isna().all()


def test_csv_path_is_unchanged_and_returns_synthetic_sheet_info():
    csv_bytes = b"PO Number,Net Value\nPO1,100\nPO2,200\n"
    df, info, warnings = _read_excel_or_csv(io.BytesIO(csv_bytes), ".csv")
    assert len(df) == 2
    # CSV doesn't get _source_sheet (single-source by definition)
    assert SOURCE_SHEET_COL not in df.columns
    assert len(info) == 1
    assert info[0]["sheet_name"] == "(csv)"
    assert info[0]["included"] is True
    assert warnings == []


def test_all_empty_sheets_returns_empty_df_with_warning():
    book = _build_workbook({
        "A": pd.DataFrame(columns=["PO Number"]),
        "B": pd.DataFrame(columns=["PO Number"]),
    })
    df, _info, warnings = _read_excel_multi_sheet(book)
    assert len(df) == 0
    assert "all_sheets_empty" in warnings
