from fastapi import APIRouter, Depends

from app.auth import require_access_code
from app.config import Settings, get_settings
from app.schemas.realtime import RealtimeSessionRequest, RealtimeSessionResponse
from app.services.openai_realtime import OpenAIRealtimeService


router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.post("/session", response_model=RealtimeSessionResponse)
async def create_realtime_session(
    body: RealtimeSessionRequest,
    _: None = Depends(require_access_code),
    settings: Settings = Depends(get_settings),
) -> RealtimeSessionResponse:
    service = OpenAIRealtimeService(settings)
    return await service.create_session(body)
