import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .core import run_llm_stream
from .ingestion import ingest

app = FastAPI(title="Document Helper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


class IngestRequest(BaseModel):
    url: str


class ChatRequest(BaseModel):
    query: str


@app.post("/ingest")
async def ingest_endpoint(request: IngestRequest):
    async def generate():
        try:
            async for event in ingest(request.url):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    async def generate():
        try:
            async for event in run_llm_stream(request.query):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
