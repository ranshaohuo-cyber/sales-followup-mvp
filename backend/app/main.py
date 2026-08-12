from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import demo_log, experience, followup, qwen_realtime, realtime


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Sales copilot demo backend with realtime session proxy, mock experience search, and demo logs.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(realtime.router, prefix=settings.api_prefix)
app.include_router(qwen_realtime.router, prefix=settings.api_prefix)
app.include_router(experience.router, prefix=settings.api_prefix)
app.include_router(demo_log.router, prefix=settings.api_prefix)
app.include_router(followup.router, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
