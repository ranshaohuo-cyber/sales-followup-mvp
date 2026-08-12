import asyncio
import json
from urllib.parse import urlencode

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.config import Settings
from app.schemas.qwen_realtime import AudioFormat, QwenRealtimeSessionResponse


ASR_ONLY_INSTRUCTIONS = (
    "ASR-only phase. Transcribe the incoming sales conversation audio. "
    "Do not generate sales coaching, do not answer the user, and do not call tools."
)


class QwenRealtimeProxyService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def create_session_descriptor(self) -> QwenRealtimeSessionResponse:
        return QwenRealtimeSessionResponse(
            provider="qwen",
            model=self.settings.qwen_realtime_model,
            websocketUrl=self.settings.qwen_public_ws_path,
            instructions=ASR_ONLY_INSTRUCTIONS,
            tools=[],
            inputAudio=AudioFormat(format="pcm16", sampleRate=16000, channels=1),
            outputAudio=AudioFormat(format="pcm16", sampleRate=24000, channels=1),
            note=(
                "Phase 2 ASR-only: the frontend streams microphone PCM to websocketUrl; "
                "the backend forwards transcription events and ignores model response events."
            ),
        )

    async def proxy(self, client_ws: WebSocket) -> None:
        await client_ws.accept()

        if not self.settings.dashscope_api_key:
            await client_ws.send_json(
                {
                    "type": "backend.error",
                    "error": "DASHSCOPE_API_KEY is not configured on the backend.",
                }
            )
            await client_ws.close(code=1011)
            return

        qwen_url = self._build_qwen_url()
        headers = {"Authorization": f"Bearer {self.settings.dashscope_api_key}"}

        try:
            import websockets

            async with websockets.connect(
                qwen_url,
                additional_headers=headers,
                ping_interval=20,
                ping_timeout=20,
            ) as qwen_ws:
                await self._send_default_session_update(qwen_ws)

                client_to_qwen = asyncio.create_task(self._forward_client_to_qwen(client_ws, qwen_ws))
                qwen_to_client = asyncio.create_task(self._forward_qwen_to_client(qwen_ws, client_ws))

                done, pending = await asyncio.wait(
                    {client_to_qwen, qwen_to_client},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                for task in pending:
                    task.cancel()
                for task in done:
                    task.result()
        except WebSocketDisconnect:
            return
        except Exception as exc:
            if client_ws.client_state == WebSocketState.CONNECTED:
                await client_ws.send_json({"type": "backend.error", "error": str(exc)})
                await client_ws.close(code=1011)

    async def _send_default_session_update(self, qwen_ws) -> None:
        await qwen_ws.send(
            json.dumps(
                {
                    "type": "session.update",
                    "session": {
                        "modalities": ["text"],
                        "input_audio_format": "pcm16",
                        "input_audio_transcription": {
                            "model": "fun-asr",
                        },
                        "instructions": ASR_ONLY_INSTRUCTIONS,
                        "turn_detection": {
                            "type": "server_vad",
                            "threshold": 0.5,
                            "silence_duration_ms": 650,
                        },
                        "max_history_turns": 1,
                        "tools": [],
                    },
                },
                ensure_ascii=False,
            )
        )

    async def _forward_client_to_qwen(self, client_ws: WebSocket, qwen_ws) -> None:
        while True:
            message = await client_ws.receive_text()
            await qwen_ws.send(message)

    async def _forward_qwen_to_client(self, qwen_ws, client_ws: WebSocket) -> None:
        async for message in qwen_ws:
            if self._suppress_generation_if_needed(message):
                continue
            await client_ws.send_text(message)

    def _suppress_generation_if_needed(self, message: str) -> bool:
        try:
            event = json.loads(message)
        except json.JSONDecodeError:
            return False

        event_type = event.get("type", "")
        return isinstance(event_type, str) and event_type.startswith("response.")

    def _build_qwen_url(self) -> str:
        return f"{self.settings.qwen_realtime_ws_url}?{urlencode({'model': self.settings.qwen_realtime_model})}"