from pydantic import BaseModel, Field


class AudioFormat(BaseModel):
    format: str
    sample_rate: int = Field(alias="sampleRate")
    channels: int


class QwenRealtimeSessionResponse(BaseModel):
    provider: str
    model: str
    websocket_url: str = Field(alias="websocketUrl")
    instructions: str
    tools: list[dict]
    input_audio: AudioFormat = Field(alias="inputAudio")
    output_audio: AudioFormat = Field(alias="outputAudio")
    note: str
