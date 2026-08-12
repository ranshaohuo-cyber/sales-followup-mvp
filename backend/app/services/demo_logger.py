import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.schemas.demo_log import DemoLogRequest, DemoLogResponse


class DemoLogger:
    def __init__(self, log_file: Path):
        self.log_file = log_file

    def write(self, body: DemoLogRequest) -> DemoLogResponse:
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        log_id = f"log_{uuid4().hex[:12]}"
        record = {
            "id": log_id,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            **body.model_dump(by_alias=True),
        }

        with self.log_file.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")

        return DemoLogResponse(ok=True, logId=log_id)
