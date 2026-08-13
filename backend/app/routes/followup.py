from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_access_code
from app.config import Settings, get_settings
from app.schemas.followup import (
    FollowupAttachmentAnalyzeRequest,
    FollowupAttachmentAnalyzeResponse,
    FollowupGenerateRequest,
    FollowupGenerateResponse,
)
from app.services.qwen_attachment import QwenAttachmentService
from app.services.qwen_followup import QwenFollowupService


router = APIRouter(prefix="/followup", tags=["followup"])


def get_followup_service(settings: Settings = Depends(get_settings)) -> QwenFollowupService:
    return QwenFollowupService(settings)


def get_attachment_service(settings: Settings = Depends(get_settings)) -> QwenAttachmentService:
    return QwenAttachmentService(settings)


@router.post("/generate", response_model=FollowupGenerateResponse)
async def generate_followup(
    body: FollowupGenerateRequest,
    _: None = Depends(require_access_code),
    service: QwenFollowupService = Depends(get_followup_service),
) -> FollowupGenerateResponse:
    try:
        return await service.generate(body)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/attachment/analyze", response_model=FollowupAttachmentAnalyzeResponse)
async def analyze_attachment(
    body: FollowupAttachmentAnalyzeRequest,
    _: None = Depends(require_access_code),
    service: QwenAttachmentService = Depends(get_attachment_service),
) -> FollowupAttachmentAnalyzeResponse:
    try:
        return await service.analyze(body)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
