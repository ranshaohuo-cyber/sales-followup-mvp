import httpx

from app.config import Settings
from app.schemas.followup import FollowupAttachmentAnalyzeRequest, FollowupAttachmentAnalyzeResponse


KIND_LABELS = {
    "photo": "现场照片",
    "floorplan": "户型图",
    "quote": "报价单",
}


class QwenAttachmentService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def analyze(self, request: FollowupAttachmentAnalyzeRequest) -> FollowupAttachmentAnalyzeResponse:
        if not self.settings.dashscope_api_key:
            raise RuntimeError("DASHSCOPE_API_KEY is not configured.")
        if not request.mimeType.startswith("image/"):
            raise ValueError("Only image attachments can be analyzed automatically.")
        if len(request.dataUrl) > 8_000_000:
            raise ValueError("Image is too large after compression.")

        model = self.settings.qwen_attachment_model
        payload = {
            "model": model,
            "input": {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"image": request.dataUrl},
                            {"text": self._prompt(request)},
                        ],
                    }
                ]
            },
            "parameters": {
                "result_format": "message",
                "temperature": 0.1,
                "top_p": 0.6,
            },
        }

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                self.settings.qwen_multimodal_generation_url,
                headers={
                    "Authorization": f"Bearer {self.settings.dashscope_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        response.raise_for_status()
        summary = self._extract_text(response.json())
        return FollowupAttachmentAnalyzeResponse(summary=summary, model=model)

    def _prompt(self, request: FollowupAttachmentAnalyzeRequest) -> str:
        kind_label = KIND_LABELS.get(request.kind, "门店资料")
        note = f"\n销售备注：{request.note}" if request.note else ""
        return (
            f"这是一张{kind_label}，用于门窗/装修/全屋定制/建材门店客户跟进。"
            "请只根据图片中清晰可见的信息，提取对后续销售跟进有用的事实。"
            "重点看：户型/尺寸/空间限制、报价金额、配置名称、数量、客户可能关心点、需要销售补问的信息。"
            "不要编造看不清的品牌、价格、面积、承诺或案例。"
            "输出 3-6 条中文短句，适合直接并入客户上下文。"
            f"{note}"
        )

    def _extract_text(self, raw: dict) -> str:
        choices = raw.get("output", {}).get("choices", [])
        if choices:
            message = choices[0].get("message", {})
            content = message.get("content")
            if isinstance(content, str):
                return content.strip()
            if isinstance(content, list):
                parts = []
                for item in content:
                    if isinstance(item, dict):
                        text = item.get("text") or item.get("content")
                        if isinstance(text, str):
                            parts.append(text)
                    elif isinstance(item, str):
                        parts.append(item)
                if parts:
                    return "\n".join(parts).strip()
        text = raw.get("output", {}).get("text")
        if isinstance(text, str):
            return text.strip()
        raise ValueError("DashScope response did not include attachment summary.")
