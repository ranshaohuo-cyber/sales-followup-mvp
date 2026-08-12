import httpx
from fastapi import HTTPException, status

from app.config import Settings
from app.schemas.realtime import RealtimeSessionRequest, RealtimeSessionResponse


REALTIME_SESSION_INSTRUCTIONS = """你是销售副驾驶，不是聊天机器人。
你正在听客户和销售的现场沟通。
你要低延迟给销售输出极短建议。
客户出现价格、竞品、预算、风险、售后、不会用、再考虑、优惠等信号时，优先调用 searchSalesExperience。
信息不足时，不调用经验库，先建议销售追问。
输出格式固定：
是否调用经验库：是/否
客户意图：12 字以内
现在做：40 字以内
现在说：40 字以内
不要长篇分析。
不要像客服。
要像销冠在耳边提醒。"""


SEARCH_SALES_EXPERIENCE_TOOL = {
    "type": "function",
    "name": "searchSalesExperience",
    "description": "搜索销售经验库，找到适合当前客户异议的下一步动作和可复述话术。",
    "parameters": {
        "type": "object",
        "properties": {
            "transcript": {
                "type": "string",
                "description": "客户刚刚说的话，尽量保留原话。",
            },
            "signals": {
                "type": "array",
                "items": {"type": "string"},
                "description": "识别到的客户信号，如价格、竞品、预算、风险、售后、不会用、再考虑、优惠。",
            },
            "intent": {
                "type": "string",
                "description": "客户当前意图，如比较竞品、价格异议、担心落地、售后顾虑、犹豫不决。",
            },
        },
        "required": ["transcript"],
        "additionalProperties": False,
    },
}


class OpenAIRealtimeService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def create_session(self, body: RealtimeSessionRequest) -> RealtimeSessionResponse:
        if not self.settings.openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OPENAI_API_KEY is not configured on the backend.",
            )

        model = body.model or self.settings.openai_realtime_model
        voice = body.voice or self.settings.openai_realtime_voice

        session_payload = {
            "type": "realtime",
            "model": model,
            "instructions": REALTIME_SESSION_INSTRUCTIONS,
            "tools": [SEARCH_SALES_EXPERIENCE_TOOL],
            "tool_choice": "auto",
            "audio": {
                "output": {
                    "voice": voice,
                }
            },
        }

        openai_payload = await self._create_client_secret(session_payload)
        client_secret = self._extract_client_secret(openai_payload)
        expires_at = self._extract_expires_at(openai_payload)

        if not client_secret:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenAI Realtime session response did not include a client secret.",
            )

        return RealtimeSessionResponse(
            sessionId=openai_payload.get("id") or body.session_id,
            clientSecret=client_secret,
            expiresAt=expires_at,
            model=model,
            instructions=REALTIME_SESSION_INSTRUCTIONS,
            tools=[SEARCH_SALES_EXPERIENCE_TOOL],
        )

    async def _create_client_secret(self, session_payload: dict) -> dict:
        headers = {
            "Authorization": f"Bearer {self.settings.openai_api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=10) as client:
            modern_response = await client.post(
                self.settings.openai_realtime_client_secret_url,
                headers=headers,
                json={"session": session_payload},
            )

            if modern_response.status_code < 400:
                return modern_response.json()

            legacy_response = await client.post(
                self.settings.openai_realtime_legacy_session_url,
                headers=headers,
                json=self._legacy_session_payload(session_payload),
            )

        if legacy_response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "message": "Failed to create OpenAI Realtime session.",
                    "modernStatus": modern_response.status_code,
                    "modernBody": self._safe_error_body(modern_response),
                    "legacyStatus": legacy_response.status_code,
                    "legacyBody": self._safe_error_body(legacy_response),
                },
            )

        return legacy_response.json()

    @staticmethod
    def _legacy_session_payload(session_payload: dict) -> dict:
        return {
            "model": session_payload["model"],
            "voice": session_payload["audio"]["output"]["voice"],
            "instructions": session_payload["instructions"],
            "tools": session_payload["tools"],
            "tool_choice": session_payload["tool_choice"],
        }

    @staticmethod
    def _extract_client_secret(payload: dict) -> str | None:
        if isinstance(payload.get("value"), str):
            return payload["value"]
        client_secret = payload.get("client_secret")
        if isinstance(client_secret, dict):
            return client_secret.get("value")
        return None

    @staticmethod
    def _extract_expires_at(payload: dict) -> int | None:
        if isinstance(payload.get("expires_at"), int):
            return payload["expires_at"]
        client_secret = payload.get("client_secret")
        if isinstance(client_secret, dict):
            return client_secret.get("expires_at")
        return None

    @staticmethod
    def _safe_error_body(response: httpx.Response) -> dict | str:
        try:
            return response.json()
        except ValueError:
            return response.text[:500]
