import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="Ops Brief API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BriefRequest(BaseModel):
    request_id: str


class WebhookIntakeRequest(BaseModel):
    source: str
    event_type: str
    request_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)


BASE_DIR = Path(__file__).resolve().parent
MOCK_DB_PATH = BASE_DIR / "mock_requests.json"


def get_windmill_token() -> str:
    return os.environ.get("WINDMILL_TOKEN", "").strip()


def get_windmill_url() -> str:
    return os.environ.get("WINDMILL_URL", "").strip()


def load_mock_db() -> dict[str, Any]:
    if not MOCK_DB_PATH.exists():
        return {}

    with open(MOCK_DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_request_id_from_payload(payload: dict[str, Any]) -> Optional[str]:
    if not payload:
        return None

    candidate_keys = [
        "request_id",
        "requestId",
        "req_id",
        "id",
        "external_id",
        "externalId",
    ]

    for key in candidate_keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


def normalize_intake_event(event: WebhookIntakeRequest) -> dict[str, Any]:
    payload = event.payload or {}
    request_id = (event.request_id or "").strip() or extract_request_id_from_payload(payload)

    return {
        "source": event.source.strip().lower(),
        "event_type": event.event_type.strip(),
        "request_id": request_id,
        "payload": payload,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }


async def call_windmill_for_brief(request_id: str) -> Optional[dict[str, Any]]:
    token = get_windmill_token()
    windmill_url = get_windmill_url()

    if not token or not windmill_url:
        return None

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                windmill_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={"request_id": request_id},
            )
            response.raise_for_status()
            data = response.json()

            if isinstance(data, dict):
                if "status" not in data:
                    data["status"] = "ok"
                data["source"] = "windmill"
                return data

            return None

    except Exception as e:
        print(f"Windmill error: {e}")
        return None


def get_local_brief(request_id: str) -> Optional[dict[str, Any]]:
    mock_db = load_mock_db()
    data = mock_db.get(request_id)

    if not data:
        return None

    if isinstance(data, dict):
        data = dict(data)
        data["source"] = "local"

    return data


@app.get("/health")
def health():
    token_present = bool(get_windmill_token())
    return {
        "status": "ok",
        "engine": "windmill" if token_present else "local",
        "token_present": token_present,
        "webhook_ready": True,
    }


@app.post("/api/brief")
async def generate_brief(payload: BriefRequest):
    request_id = payload.request_id.strip()

    if not request_id:
        return {
            "status": "error",
            "message": "request_id is required"
        }

    windmill_result = await call_windmill_for_brief(request_id)
    if windmill_result:
        return windmill_result

    local_result = get_local_brief(request_id)
    if local_result:
        return local_result

    return {
        "status": "error",
        "message": f"No data found for {request_id}"
    }


@app.post("/webhooks/intake")
async def webhook_intake(event: WebhookIntakeRequest):
    normalized = normalize_intake_event(event)
    request_id = normalized["request_id"]

    if not request_id:
        return {
            "status": "error",
            "message": "No request_id found in webhook payload",
            "normalized_event": normalized,
        }

    windmill_result = await call_windmill_for_brief(request_id)

    if windmill_result:
        return {
            "status": "ok",
            "triggered": True,
            "normalized_event": normalized,
            "brief": windmill_result,
        }

    local_result = get_local_brief(request_id)
    if local_result:
        return {
            "status": "ok",
            "triggered": True,
            "normalized_event": normalized,
            "brief": local_result,
        }

    return {
        "status": "error",
        "message": f"No data found for request_id {request_id}",
        "normalized_event": normalized,
    }