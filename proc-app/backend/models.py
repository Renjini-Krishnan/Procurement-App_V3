"""Pydantic models for API request/response shapes."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# Engagement
# --------------------------------------------------------------------------

class EngagementCreate(BaseModel):
    client_name: str = Field(..., min_length=1)
    industry: str = Field(..., pattern="^(steel|cement)$")
    sub_segment: Optional[str] = None
    plants: list[str] = Field(default_factory=list)
    annual_spend_inr_cr: Optional[float] = None
    annual_revenue_inr_cr: Optional[float] = None
    fte_count: Optional[int] = None


class EngagementResponse(BaseModel):
    id: str
    client_name: str
    industry: str
    sub_segment: Optional[str]
    plants: list[str]
    annual_spend_inr_cr: Optional[float]
    annual_revenue_inr_cr: Optional[float]
    fte_count: Optional[int]
    created_at: str
    updated_at: str
    current_stage_id: int
    status: str


# --------------------------------------------------------------------------
# KB
# --------------------------------------------------------------------------

class PillarSummary(BaseModel):
    pillar: str
    themes: list[str]
    components_count: int
    files_present: dict[str, list[str]]


class BenchmarkEntry(BaseModel):
    id: str
    source: str = Field(..., description="function_default | industry_overlay")
    overridden_by: Optional[str] = None
    data: dict[str, Any]


class CascadedBenchmarks(BaseModel):
    pillar: str
    industry: Optional[str]
    benchmarks: dict[str, dict[str, Any]]


# --------------------------------------------------------------------------
# Stage
# --------------------------------------------------------------------------

class StageInfo(BaseModel):
    id: int
    phase: str
    name: str
    slug: str
    status: str = "todo"
    locked: bool = False


class StageProgressUpdate(BaseModel):
    status: str = Field(..., pattern="^(todo|in_progress|done|skipped)$")
    output: Optional[Any] = None
