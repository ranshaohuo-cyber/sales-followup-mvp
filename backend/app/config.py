import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = "销售副驾驶 Demo Backend"
    api_prefix: str = "/api"

    openai_api_key: str | None = None
    openai_realtime_model: str = "gpt-realtime"
    openai_realtime_voice: str = "marin"
    openai_realtime_client_secret_url: str = "https://api.openai.com/v1/realtime/client_secrets"
    openai_realtime_legacy_session_url: str = "https://api.openai.com/v1/realtime/sessions"

    dashscope_api_key: str | None = None
    qwen_realtime_model: str = "qwen-audio-3.0-realtime-plus"
    qwen_realtime_voice: str = "longanqian"
    qwen_realtime_ws_url: str = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
    qwen_public_ws_path: str = "/api/qwen/realtime/ws"
    qwen_text_generation_url: str = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    qwen_followup_model: str = "qwen-plus"
    qwen_premium_followup_model: str = "qwen-max"
    public_access_code: str | None = None

    cors_origins: list[str] = field(default_factory=list)

    data_dir: Path = Path(__file__).resolve().parent / "data"
    experiences_file: Path = field(default_factory=lambda: Path(__file__).resolve().parent / "data" / "experiences.json")
    demo_log_file: Path = field(default_factory=lambda: Path(__file__).resolve().parent / "data" / "demo_logs.jsonl")


@lru_cache
def get_settings() -> Settings:
    load_dotenv()
    data_dir = Path(__file__).resolve().parent / "data"
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_realtime_model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
        openai_realtime_voice=os.getenv("OPENAI_REALTIME_VOICE", "marin"),
        openai_realtime_client_secret_url=os.getenv(
            "OPENAI_REALTIME_CLIENT_SECRET_URL",
            "https://api.openai.com/v1/realtime/client_secrets",
        ),
        openai_realtime_legacy_session_url=os.getenv(
            "OPENAI_REALTIME_LEGACY_SESSION_URL",
            "https://api.openai.com/v1/realtime/sessions",
        ),
        dashscope_api_key=os.getenv("DASHSCOPE_API_KEY"),
        qwen_realtime_model=os.getenv("QWEN_REALTIME_MODEL", "qwen-audio-3.0-realtime-plus"),
        qwen_realtime_voice=os.getenv("QWEN_REALTIME_VOICE", "longanqian"),
        qwen_realtime_ws_url=os.getenv(
            "QWEN_REALTIME_WS_URL",
            "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        ),
        qwen_public_ws_path=os.getenv("QWEN_PUBLIC_WS_PATH", "/api/qwen/realtime/ws"),
        qwen_text_generation_url=os.getenv(
            "QWEN_TEXT_GENERATION_URL",
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
        ),
        qwen_followup_model=os.getenv("QWEN_FOLLOWUP_MODEL", "qwen-plus"),
        qwen_premium_followup_model=os.getenv("QWEN_PREMIUM_FOLLOWUP_MODEL", "qwen-max"),
        public_access_code=os.getenv("PUBLIC_ACCESS_CODE"),
        cors_origins=parse_cors_origins(
            os.getenv(
                "CORS_ORIGINS",
                '["http://localhost:5173","http://127.0.0.1:5173","http://localhost:4173","http://127.0.0.1:4173"]',
            )
        ),
        data_dir=data_dir,
        experiences_file=data_dir / "experiences.json",
        demo_log_file=data_dir / "demo_logs.jsonl",
    )


def load_dotenv() -> None:
    env_path = Path.cwd() / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def parse_cors_origins(raw_value: str) -> list[str]:
    try:
        parsed = json.loads(raw_value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except json.JSONDecodeError:
        pass

    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]
