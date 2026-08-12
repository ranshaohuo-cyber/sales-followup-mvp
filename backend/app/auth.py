from fastapi import Depends, Header, HTTPException, WebSocket

from app.config import Settings, get_settings


def require_access_code(
    x_access_code: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.public_access_code:
        return
    if x_access_code == settings.public_access_code:
        return
    raise HTTPException(status_code=401, detail="Invalid access code.")


async def require_websocket_access_code(websocket: WebSocket, settings: Settings) -> bool:
    if not settings.public_access_code:
        return True

    access_code = websocket.query_params.get("access_code") or websocket.headers.get("x-access-code")
    if access_code == settings.public_access_code:
        return True

    await websocket.accept()
    await websocket.send_json({"type": "backend.error", "error": "Invalid access code."})
    await websocket.close(code=1008)
    return False
