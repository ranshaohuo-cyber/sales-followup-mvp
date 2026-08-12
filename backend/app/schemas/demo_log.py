from pydantic import BaseModel, Field


class DemoLogRequest(BaseModel):
    session_id: str = Field(alias="sessionId")
    transcript: str
    used_experience: bool = Field(alias="usedExperience")
    latency_ms: int = Field(alias="latencyMs", ge=0)
    action: str
    speech: str


class DemoLogResponse(BaseModel):
    ok: bool
    log_id: str = Field(alias="logId")
