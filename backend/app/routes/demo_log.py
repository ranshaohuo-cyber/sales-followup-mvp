from fastapi import APIRouter, Depends

from app.auth import require_access_code
from app.config import Settings, get_settings
from app.schemas.demo_log import DemoLogRequest, DemoLogResponse
from app.services.demo_logger import DemoLogger


router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/log", response_model=DemoLogResponse)
def write_demo_log(
    body: DemoLogRequest,
    _: None = Depends(require_access_code),
    settings: Settings = Depends(get_settings),
) -> DemoLogResponse:
    logger = DemoLogger(settings.demo_log_file)
    return logger.write(body)
