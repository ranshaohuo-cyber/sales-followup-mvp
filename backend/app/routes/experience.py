from fastapi import APIRouter, Depends

from app.auth import require_access_code
from app.config import Settings, get_settings
from app.schemas.experience import (
    ExperienceItem,
    ExperienceSearchRequest,
    ExperienceSearchResponse,
)
from app.services.experience_search import ExperienceSearchService


router = APIRouter(tags=["experience"])


def get_experience_service(settings: Settings = Depends(get_settings)) -> ExperienceSearchService:
    return ExperienceSearchService(settings.experiences_file)


@router.get("/experiences", response_model=list[ExperienceItem])
def list_experiences(
    _: None = Depends(require_access_code),
    service: ExperienceSearchService = Depends(get_experience_service),
) -> list[ExperienceItem]:
    return service.list_experiences()


@router.post("/experience/search", response_model=ExperienceSearchResponse)
def search_experience(
    body: ExperienceSearchRequest,
    _: None = Depends(require_access_code),
    service: ExperienceSearchService = Depends(get_experience_service),
) -> ExperienceSearchResponse:
    return service.search(body)
