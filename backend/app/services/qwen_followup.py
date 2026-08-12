import json
import re

import httpx

from app.config import Settings
from app.schemas.followup import FollowupGenerateRequest, FollowupGenerateResponse


INDUSTRY_LABELS = {
    "windows": "门窗",
    "renovation": "装修",
    "custom_furniture": "全屋定制",
    "building_materials": "建材",
}

STATUS_LABELS = {
    "new_inquiry": "刚咨询",
    "comparing": "比价中",
    "hesitating": "犹豫中",
    "ready_to_close": "准备成交",
    "silent": "已沉默",
}


class QwenFollowupService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate(self, request: FollowupGenerateRequest) -> FollowupGenerateResponse:
        if not self.settings.dashscope_api_key:
            raise RuntimeError("DASHSCOPE_API_KEY is not configured.")

        model = self._model_for_quality(request.quality)
        payload = {
            "model": model,
            "input": {
                "messages": [
                    {
                        "role": "system",
                        "content": self._system_prompt(),
                    },
                    {
                        "role": "user",
                        "content": self._user_prompt(request),
                    },
                ],
            },
            "parameters": {
                "result_format": "message",
                "temperature": 0.2,
                "top_p": 0.8,
            },
        }

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                self.settings.qwen_text_generation_url,
                headers={
                    "Authorization": f"Bearer {self.settings.dashscope_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        response.raise_for_status()
        content = self._extract_content(response.json())
        data = self._parse_json_object(content)
        data["model"] = model
        data["quality"] = request.quality
        return FollowupGenerateResponse(**data)

    def _model_for_quality(self, quality: str) -> str:
        if quality == "premium":
            return self.settings.qwen_premium_followup_model
        return self.settings.qwen_followup_model

    def _system_prompt(self) -> str:
        return (
            "你是齐齐哈尔本地门店销售复盘助手，服务门窗、装修、全屋定制、建材门店。"
            "你的任务不是泛泛分析，而是从可能混杂、未区分说话人的录音转写里，整理出销售马上能复制使用的跟进卡。"
            "接待记录可能没有准确标注销售/客户/噪音，你要优先提取客户需求、顾虑、预算/比较信号、销售已经回应过的点和下一步动作。严禁编造接待记录里没有出现的小区、人名、客户案例、具体价格、折扣、质保年限、品牌和承诺。"
            "如果信息不足，用“类似案例”“两档配置”“预算区间待确认”等稳妥表达。"
            "微信话术里不要写“附图”“实拍”“本地加工车间”“德系五金”“差价多少”等未给出的具体事实。"
            "如需引用资料，只能写“我给您整理一份配置对比/类似案例”，不能假装已经有图片或案例。"
            "输出必须是严格 JSON，不要 Markdown，不要代码块，不要额外解释。"
            "话术要像本地门店微信沟通，短、自然、低压力、能复制。"
        )

    def _user_prompt(self, request: FollowupGenerateRequest) -> str:
        return f"""
行业：{INDUSTRY_LABELS[request.industry]}
客户状态：{STATUS_LABELS[request.customerStatus]}

接待原始转写（可能混有销售、客户和旁人声音，不保证说话人标签准确）：
{request.transcript}

请输出以下 JSON 结构，字段必须完整：
{{
  "intentLevel": "高意向|中意向|低意向|待判断",
  "primaryConcern": "从原始转写里推断客户最关心什么，1-2句；如果无法判断就写信息不足",
  "currentStage": "客户状态 + 成交阶段",
  "missedPoint": "销售刚才可能漏掉的关键点，1句；如果原文不足就写需要补问什么",
  "nextAction": "下一步跟进动作，1-2句",
  "wechatScript": "可直接复制发微信的话术，80-160字；只能使用接待记录里的事实，不能编造案例、图片、价格、配置、品牌、年限",
  "planTitle": "行业初版方案方向",
  "planOptions": [
    {{"title": "方案A名称", "description": "适用情况和沟通重点"}},
    {{"title": "方案B名称", "description": "适用情况和沟通重点"}},
    {{"title": "方案C名称", "description": "适用情况和沟通重点"}}
  ],
  "signals": [
    {{"label": "识别信号", "evidence": "来自对话的证据"}}
  ],
  "context": {{
    "stage": "opening|discovery|solution_presentation|objection_handling|pricing|closing|unknown",
    "customerState": "interested|neutral|hesitant|price_sensitive|skeptical|ready_to_buy|unknown",
    "customerIntent": "asking_information|comparing|objecting|negotiating|buying_signal|leaving|unknown",
    "objectionType": "price|trust|need|timing|competitor|authority|unknown",
    "riskLevel": "low|medium|high|unknown",
    "confidence": 0.0
  }}
}}
""".strip()

    def _extract_content(self, raw: dict) -> str:
        choices = raw.get("output", {}).get("choices", [])
        if choices:
            message = choices[0].get("message", {})
            content = message.get("content")
            if isinstance(content, str):
                return content
        text = raw.get("output", {}).get("text")
        if isinstance(text, str):
            return text
        raise ValueError("DashScope response did not include generated content.")

    def _parse_json_object(self, content: str) -> dict:
        stripped = content.strip()
        if stripped.startswith("```"):
            stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
            stripped = re.sub(r"\s*```$", "", stripped)

        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", stripped, re.DOTALL)
            if not match:
                raise
            parsed = json.loads(match.group(0))

        if not isinstance(parsed, dict):
            raise ValueError("Generated followup result is not a JSON object.")
        return parsed
