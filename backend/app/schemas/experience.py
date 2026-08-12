from pydantic import BaseModel, Field


class ExperienceSearchRequest(BaseModel):
    transcript: str
    signals: list[str] = Field(default_factory=list)
    intent: str | None = None
    limit: int = Field(default=3, ge=1, le=10)


class ExperienceItem(BaseModel):
    id: str
    title: str
    tags: list[str]
    action: str
    script: str
    confidence: float = 0


class ExperienceRecord(ExperienceItem):
    keywords: list[str] = Field(default_factory=list)
    intents: list[str] = Field(default_factory=list)
    scenario: str


class ExperienceSearchResponse(BaseModel):
    should_use_experience: bool = Field(alias="shouldUseExperience")
    items: list[ExperienceItem]
