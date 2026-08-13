from typing import Literal

from pydantic import BaseModel, Field


FollowupIndustry = Literal["windows", "renovation", "custom_furniture", "building_materials"]
FollowupCustomerStatus = Literal["new_inquiry", "comparing", "hesitating", "ready_to_close", "silent"]
FollowupQuality = Literal["standard", "premium"]
AttachmentKind = Literal["photo", "floorplan", "quote"]


class FollowupGenerateRequest(BaseModel):
    industry: FollowupIndustry
    customerStatus: FollowupCustomerStatus
    transcript: str = Field(min_length=1)
    quality: FollowupQuality = "standard"


class FollowupAttachmentAnalyzeRequest(BaseModel):
    kind: AttachmentKind
    name: str
    mimeType: str
    dataUrl: str = Field(min_length=1)
    note: str | None = None


class FollowupAttachmentAnalyzeResponse(BaseModel):
    summary: str
    model: str


class FollowupSignal(BaseModel):
    label: str
    evidence: str


class FollowupPlanOption(BaseModel):
    title: str
    description: str


class FollowupContext(BaseModel):
    stage: str
    customerState: str
    customerIntent: str
    objectionType: str
    riskLevel: str
    confidence: float = Field(ge=0, le=1)


class FollowupGenerateResponse(BaseModel):
    intentLevel: str
    primaryConcern: str
    currentStage: str
    missedPoint: str
    nextAction: str
    wechatScript: str
    planTitle: str
    planOptions: list[FollowupPlanOption]
    signals: list[FollowupSignal]
    context: FollowupContext
    model: str
    quality: FollowupQuality
