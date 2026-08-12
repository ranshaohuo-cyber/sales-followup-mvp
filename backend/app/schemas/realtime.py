from pydantic import BaseModel, Field


class RealtimeSessionRequest(BaseModel):
    session_id: str | None = Field(default=None, alias="sessionId")
    model: str | None = None
    voice: str | None = None


class RealtimeSessionResponse(BaseModel):
    session_id: str | None = Field(default=None, alias="sessionId")
    client_secret: str = Field(alias="clientSecret")
    expires_at: int | None = Field(default=None, alias="expiresAt")
    model: str
    instructions: str
    tools: list[dict]
