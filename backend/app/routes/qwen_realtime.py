from fastapi import APIRouter, Depends, WebSocket

from app.auth import require_access_code, require_websocket_access_code
from app.config import Settings, get_settings
from app.schemas.qwen_realtime import QwenRealtimeSessionResponse
from app.services.qwen_realtime import QwenRealtimeProxyService


router = APIRouter(prefix="/qwen/realtime", tags=["qwen-realtime"])


@router.post("/session", response_model=QwenRealtimeSessionResponse)
def create_qwen_realtime_session(
    _: None = Depends(require_access_code),
    settings: Settings = Depends(get_settings),
) -> QwenRealtimeSessionResponse:
    service = QwenRealtimeProxyService(settings)
    return service.create_session_descriptor()


@router.websocket("/ws")
async def qwen_realtime_websocket(
    websocket: WebSocket,
    settings: Settings = Depends(get_settings),
) -> None:
    if not await require_websocket_access_code(websocket, settings):
        return
    service = QwenRealtimeProxyService(settings)
    await service.proxy(websocket)
