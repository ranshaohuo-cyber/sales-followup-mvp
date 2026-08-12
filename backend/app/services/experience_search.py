import json
from pathlib import Path

from app.schemas.experience import (
    ExperienceItem,
    ExperienceRecord,
    ExperienceSearchRequest,
    ExperienceSearchResponse,
)


class ExperienceSearchService:
    def __init__(self, experiences_file: Path):
        self.experiences_file = experiences_file

    def list_experiences(self) -> list[ExperienceItem]:
        return [
            ExperienceItem(**record.model_dump())
            for record in self._load_records()
        ]

    def search(self, request: ExperienceSearchRequest) -> ExperienceSearchResponse:
        query_parts = [request.transcript, request.intent or "", *request.signals]
        query = " ".join(query_parts).lower()
        signal_set = {signal.strip().lower() for signal in request.signals if signal.strip()}

        scored: list[tuple[float, ExperienceRecord]] = []
        for record in self._load_records():
            score = 0.0

            for keyword in record.keywords:
                if keyword.lower() in query:
                    score += 2.0

            for tag in record.tags:
                if tag.lower() in query or tag.lower() in signal_set:
                    score += 1.5

            for intent in record.intents:
                if intent.lower() in query:
                    score += 2.5

            if score > 0:
                confidence = min(0.99, 0.72 + score * 0.04)
                record.confidence = round(confidence, 2)
                scored.append((score, record))

        scored.sort(key=lambda item: item[0], reverse=True)
        items = [
            ExperienceItem(**record.model_dump())
            for _, record in scored[: request.limit]
        ]

        return ExperienceSearchResponse(
            shouldUseExperience=bool(items),
            items=items,
        )

    def _load_records(self) -> list[ExperienceRecord]:
        with self.experiences_file.open("r", encoding="utf-8") as file:
            raw_items = json.load(file)
        return [ExperienceRecord(**item) for item in raw_items]
