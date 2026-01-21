"""
FastAPI server using lite harness (no SDK dependency)

This is a simpler version that uses direct API calls.
"""

import asyncio
import json
import os
import re
from typing import Any
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

from harness_lite import MultiPassHarnessLite, HarnessResult
from scratchpad import Scratchpad

# Store sessions
sessions: dict[str, Scratchpad] = {}
harness_results: dict[str, HarnessResult] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting multi-pass harness server (lite)...")
    yield
    print("Shutting down...")


app = FastAPI(
    title="Dialectic Multi-Pass Harness (Lite)",
    description="Multi-pass reasoning harness using direct Anthropic API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Models
class Claim(BaseModel):
    id: str
    text: str
    type: str = "claim"
    snippet: str = ""
    quote_start: int = 0
    quote_end: int = 0


class IngestRequest(BaseModel):
    url: str | None = None
    text: str | None = None
    title: str | None = None
    api_key: str | None = None


class IngestResponse(BaseModel):
    session_id: str
    title: str
    text: str
    claims: list[Claim]


class HarnessRequest(BaseModel):
    title: str
    claims: list[Claim]
    initial_context: str = ""
    max_cycles: int = 5
    api_key: str | None = None


class RouterInfo(BaseModel):
    route_type: str  # FIT, ADJACENT, NET_NEW
    confidence: float
    reasoning: str
    matched_theses: list[str]  # thesis IDs
    matched_patterns: list[str]  # pattern IDs
    budget: dict  # token allocation


class HarnessResponse(BaseModel):
    session_id: str
    title: str
    final_synthesis: str
    final_confidence: float
    confidence_trajectory: list[float]
    trajectory_analysis: dict
    termination_reason: str
    total_duration_ms: int
    total_tokens: int
    passes: list[dict]
    scratchpad_rendered: str
    router_info: RouterInfo | None = None


# Utilities
def get_api_key(request_key: str | None) -> str:
    key = request_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(status_code=400, detail="API key required (pass api_key or set ANTHROPIC_API_KEY)")
    return key


async def fetch_url(url: str) -> tuple[str, str]:
    """Fetch and parse URL"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0, verify=False, headers=headers) as client:
        response = await client.get(url)
        response.raise_for_status()
        html = response.text

    # Clean HTML
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)

    title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    title = title_match.group(1).strip() if title_match else "Untitled"

    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text).strip()

    return text, title


async def extract_claims(text: str, title: str, api_key: str) -> list[Claim]:
    """Extract claims using Claude"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 2048,
                "system": """Extract 3-7 key claims from source material.

Return ONLY valid JSON array:
[
  {
    "id": "CLAIM-1",
    "text": "Summary (1-2 sentences)",
    "type": "core_thesis|framework|meta|counter",
    "snippet": "Exact verbatim quote"
  }
]""",
                "messages": [{"role": "user", "content": f"# {title}\n\n{text[:8000]}"}],
            },
        )
        response.raise_for_status()
        data = response.json()

    content = data["content"][0]["text"]
    json_str = re.sub(r'```json?\s*|\s*```', '', content).strip()
    claims_data = json.loads(json_str)

    claims = []
    for i, c in enumerate(claims_data):
        snippet = c.get("snippet", "")
        quote_start = text.find(snippet)
        claims.append(Claim(
            id=c.get("id", f"CLAIM-{i+1}"),
            text=c.get("text", ""),
            type=c.get("type", "claim"),
            snippet=snippet,
            quote_start=max(0, quote_start),
            quote_end=quote_start + len(snippet) if quote_start != -1 else 0,
        ))
    return claims


# Endpoints
@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/ingest", response_model=IngestResponse)
async def ingest(request: IngestRequest):
    api_key = get_api_key(request.api_key)

    if request.url:
        text, title = await fetch_url(request.url)
    elif request.text:
        text = request.text
        title = request.title or "Pasted Content"
    else:
        raise HTTPException(status_code=400, detail="url or text required")

    claims = await extract_claims(text, title, api_key)
    session_id = f"ingest-{int(datetime.now().timestamp())}"

    return IngestResponse(
        session_id=session_id,
        title=title,
        text=text,
        claims=claims,
    )


@app.post("/harness/run", response_model=HarnessResponse)
async def run_harness(request: HarnessRequest):
    """Run multi-pass harness"""
    api_key = get_api_key(request.api_key)

    harness = MultiPassHarnessLite(
        api_key=api_key,
        max_cycles=request.max_cycles,
    )

    result = await harness.run(
        title=request.title,
        claims=[c.model_dump() for c in request.claims],
        initial_context=request.initial_context,
    )

    harness_results[result.session_id] = result
    if result.scratchpad:
        sessions[result.session_id] = result.scratchpad

    # Extract router info from harness
    router_info = None
    if harness.router_result:
        router_info = RouterInfo(
            route_type=harness.router_result.route_type.value.upper(),
            confidence=harness.router_result.confidence,
            reasoning=harness.router_result.reasoning,
            matched_theses=[t.id for t in harness.router_result.matched_theses],
            matched_patterns=[p.id for p in harness.router_result.matched_patterns],
            budget={
                "thesis_tokens": harness.router_result.budget.thesis_tokens,
                "pattern_tokens": harness.router_result.budget.pattern_tokens,
                "data_tokens": harness.router_result.budget.data_tokens,
                "reasoning_tokens": harness.router_result.budget.reasoning_tokens,
            },
        )

    return HarnessResponse(
        session_id=result.session_id,
        title=result.title,
        final_synthesis=result.final_synthesis,
        final_confidence=result.final_confidence,
        confidence_trajectory=result.confidence_trajectory,
        trajectory_analysis=result.trajectory_analysis,
        termination_reason=result.termination_reason,
        total_duration_ms=result.total_duration_ms,
        total_tokens=result.total_tokens,
        passes=[
            {
                "pass_type": p.pass_type,
                "confidence": p.confidence,
                "duration_ms": p.duration_ms,
                "tokens_used": p.tokens_used,
            }
            for p in result.passes
        ],
        scratchpad_rendered=result.scratchpad.render() if result.scratchpad else "",
        router_info=router_info,
    )


@app.websocket("/ws/harness")
async def websocket_harness(websocket: WebSocket):
    """WebSocket for streaming harness progress"""
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("action") == "run":
                api_key = data.get("api_key") or os.environ.get("ANTHROPIC_API_KEY")
                if not api_key:
                    await websocket.send_json({"event": "error", "data": {"message": "API key required"}})
                    continue

                async def on_progress(event: str, event_data: Any):
                    await websocket.send_json({"event": event, "data": event_data})

                harness = MultiPassHarnessLite(
                    api_key=api_key,
                    max_cycles=data.get("max_cycles", 5),
                    on_progress=on_progress,
                )

                try:
                    result = await harness.run(
                        title=data.get("title", "Untitled"),
                        claims=data.get("claims", []),
                    )

                    harness_results[result.session_id] = result
                    if result.scratchpad:
                        sessions[result.session_id] = result.scratchpad

                    # Build router info for WebSocket response
                    router_info_data = None
                    if harness.router_result:
                        router_info_data = {
                            "route_type": harness.router_result.route_type.value.upper(),
                            "confidence": harness.router_result.confidence,
                            "reasoning": harness.router_result.reasoning,
                            "matched_theses": [t.id for t in harness.router_result.matched_theses],
                            "matched_patterns": [p.id for p in harness.router_result.matched_patterns],
                            "budget": {
                                "thesis_tokens": harness.router_result.budget.thesis_tokens,
                                "pattern_tokens": harness.router_result.budget.pattern_tokens,
                                "data_tokens": harness.router_result.budget.data_tokens,
                                "reasoning_tokens": harness.router_result.budget.reasoning_tokens,
                            },
                        }

                    await websocket.send_json({
                        "event": "complete",
                        "data": {
                            "session_id": result.session_id,
                            "final_synthesis": result.final_synthesis,
                            "final_confidence": result.final_confidence,
                            "confidence_trajectory": result.confidence_trajectory,
                            "trajectory_analysis": result.trajectory_analysis,
                            "termination_reason": result.termination_reason,
                            "total_duration_ms": result.total_duration_ms,
                            "total_tokens": result.total_tokens,
                            "scratchpad_rendered": result.scratchpad.render() if result.scratchpad else "",
                            "router_info": router_info_data,
                        },
                    })
                except Exception as e:
                    await websocket.send_json({"event": "error", "data": {"message": str(e)}})

            elif data.get("action") == "ping":
                await websocket.send_json({"event": "pong"})

    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
