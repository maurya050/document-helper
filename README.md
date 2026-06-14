# document-helper

A RAG-powered chatbot that turns any documentation website into a queryable knowledge base. Paste a URL, wait for indexing, then ask questions and get answers with inline source citations — all streamed in real time.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│                      Next.js 14 Frontend                        │
│   ┌─────────────┐            ┌─────────────────────────────┐   │
│   │  URL Ingest  │            │        Chat Interface        │   │
│   │   Wizard     │            │  (streaming + citations)    │   │
│   └──────┬──────┘            └──────────────┬──────────────┘   │
└──────────┼────────────────────────────────────┼─────────────────┘
           │ POST /ingest (SSE)                  │ POST /chat (SSE)
           ▼                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (port 8000)                  │
│   ┌──────────────────────┐   ┌────────────────────────────┐    │
│   │   ingestion.py        │   │       core.py              │    │
│   │  ingest(url) async    │   │  run_llm_stream(query)     │    │
│   │  generator            │   │  async generator           │    │
│   └──────────┬───────────┘   └──────────────┬─────────────┘    │
└──────────────┼──────────────────────────────┼──────────────────┘
               │                              │
        ┌──────┴──────┐              ┌────────┴───────┐
        │   Tavily     │              │   LangChain    │
        │  TavilyCrawl │              │  Agent +       │
        │  (web crawl) │              │  retrieve_context │
        └──────┬──────┘              └────────┬───────┘
               │ Documents                    │ Similarity search
               ▼                              ▼
        ┌──────────────────────────────────────────────┐
        │                  Pinecone                     │
        │         Dense Index: langchain-docs-2026      │
        │         text-embedding-3-small (1536-dim)     │
        └──────────────────────────────────────────────┘
                                              │
                                              │ Retrieved chunks
                                              ▼
                                     ┌────────────────┐
                                     │   OpenAI LLM   │
                                     │  (gpt-4 class) │
                                     └────────────────┘
```

### Data Flow

**Ingestion (one-time per document set):**
1. Frontend sends `POST /ingest` with the target URL
2. Backend wipes the Pinecone index (`delete_all=True`, ignoring 404 on empty namespace)
3. `TavilyCrawl` crawls up to `max_depth=5` pages from the URL
4. Pages with no `raw_content` (blocked/login-walled) are filtered out
5. Remaining pages are split into 4000-char chunks with 200-char overlap
6. Chunks are batch-indexed into Pinecone (50 per batch) with source URL metadata
7. Each step streams a progress event to the frontend via SSE

**Chat (per query):**
1. Frontend sends `POST /chat` with the user query
2. A LangChain agent is created with the `retrieve_context` tool
3. Agent calls `retrieve_context(query)` → top-4 similar chunks from Pinecone
4. Agent generates an answer grounded in the retrieved chunks
5. Tokens stream back via `astream_events` → SSE to frontend
6. After generation, source URLs are extracted from the tool call artifact and sent as a final event

---

## Project Structure

```
document-helper/
├── backend/
│   ├── __init__.py          # Makes backend/ a Python package
│   ├── app.py               # FastAPI app, /ingest and /chat endpoints
│   ├── core.py              # LangChain agent + run_llm_stream()
│   ├── ingestion.py         # Crawl, chunk, embed, index pipeline
│   └── logger.py            # ANSI colored logging utilities
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css  # Tailwind v4 (@import "tailwindcss")
│   │   │   ├── layout.tsx   # Root layout, Inter font
│   │   │   └── page.tsx     # Two-step state machine (ingest → chat)
│   │   ├── components/
│   │   │   ├── ChatInput.tsx      # Auto-growing textarea, Enter to send
│   │   │   ├── ChatWindow.tsx     # Message list + auto-scroll + header
│   │   │   ├── MessageBubble.tsx  # Markdown rendering with react-markdown
│   │   │   └── SourceCitation.tsx # Collapsible source links
│   │   └── types.ts         # Message type definition
│   ├── .env.local           # NEXT_PUBLIC_API_URL=http://localhost:8000
│   └── package.json
├── pyproject.toml           # Python dependencies (uv)
└── uv.lock
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- [uv](https://github.com/astral-sh/uv) for Python package management
- Pinecone account with a **Dense** index named `langchain-docs-2026` (region: `aws us-east-1`, dimensions: 1536)
- OpenAI API key
- Tavily API key

---

## Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
TAVILY_API_KEY=tvly-...
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Setup & Running

### Backend

```bash
# Install dependencies
uv sync

# Start the FastAPI server
.venv/bin/uvicorn backend.app:app --port 8000 --reload
```

The API is now available at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI is now available at `http://localhost:3000`.

---

## API Reference

### `POST /ingest`

Crawl and index a documentation website. Returns a **Server-Sent Events** stream.

**Request:**
```json
{ "url": "https://docs.example.com/" }
```

**Event stream:**
```
data: {"type": "progress", "message": "Clearing previous index..."}
data: {"type": "progress", "message": "Crawling https://docs.example.com/ — this may take a few minutes"}
data: {"type": "progress", "message": "Crawled 42 pages"}
data: {"type": "progress", "message": "Split into 187 chunks"}
data: {"type": "progress", "message": "Indexed batch 1/4"}
...
data: {"type": "done", "chunks": 187}
```

On error: `{"type": "error", "message": "..."}`

---

### `POST /chat`

Answer a query using the indexed documentation. Returns a **Server-Sent Events** stream.

**Request:**
```json
{ "query": "How do I use LangGraph?" }
```

**Event stream:**
```
data: {"type": "token", "content": "LangGraph"}
data: {"type": "token", "content": " is a library"}
...
data: {"type": "sources", "sources": ["https://docs.example.com/langgraph"]}
data: {"type": "done"}
```

On error: `{"type": "error", "message": "..."}`

---

## Implementation Details

### Ingestion Pipeline (`backend/ingestion.py`)

The pipeline is an `async` generator that yields progress dicts so callers can stream status without buffering the entire run.

**Key decisions:**
- **Pinecone wipe before re-index**: Each ingest replaces all content. The `delete_all=True` call is wrapped in a try/except that ignores `404` / "Namespace not found" errors, which Pinecone raises on a brand-new empty index.
- **`asyncio.to_thread` for sync calls**: Tavily and Pinecone SDKs are synchronous. They're wrapped in `asyncio.to_thread(...)` to avoid blocking the event loop.
- **`raw_content` filter**: Some pages (login walls, bot-blocked pages) return `null` for `raw_content`. These are filtered before creating `Document` objects to avoid Pydantic validation errors.
- **Batch indexing**: Documents are indexed 50 at a time to stay within API limits. Each batch failure is reported as an error event rather than crashing the whole run.

### RAG Agent (`backend/core.py`)

Uses LangChain's `create_agent` with a single `retrieve_context` tool decorated with `@tool(response_format="content_and_artifact")`. This decoration returns both the serialized text (for the LLM prompt) and the raw `Document` objects (as an artifact), making it possible to extract source URLs after the tool call without a second lookup.

**Streaming with `astream_events`:**
- `on_chat_model_stream` events yield individual text tokens
- `on_tool_end` events (filtered to `retrieve_context`) yield the artifact containing source documents
- Sources are collected during streaming and emitted as a single event after generation completes

### Frontend SSE Parsing (`frontend/src/app/page.tsx`, `UrlInput.tsx`)

SSE responses are read via the `ReadableStream` API. Raw TCP packets don't respect SSE message boundaries, so a buffer accumulation pattern is used:

```ts
buffer += decoder.decode(value)
const lines = buffer.split('\n')
buffer = lines.pop() ?? ''   // keep the incomplete last line
```

Each complete line is then parsed independently, with a try/catch around `JSON.parse` to silently skip malformed lines.

### Markdown Rendering (`frontend/src/components/MessageBubble.tsx`)

LLM responses contain markdown (headers, lists, code blocks, links). `react-markdown` with `remark-gfm` renders these with custom Tailwind-styled components. A pulsing cursor (`animate-pulse`) is appended while the message is still streaming.

### Tailwind v4

This project uses Tailwind CSS v4 (installed by `create-next-app`). The global CSS uses the v4 import syntax:

```css
@import "tailwindcss";
```

The v3 `@tailwind base/components/utilities` directives do not work with v4.

---

## Known Limitations

- **One document set at a time**: Ingesting a new URL wipes the entire Pinecone index. Multi-namespace support is not implemented.
- **Tavily crawl depth**: `max_depth` is capped at 5 by the Tavily API plan. Large documentation sites may not be fully indexed in a single pass.
- **No persistence**: Chat history is in-memory only. Refreshing the browser starts a new session.
- **CORS locked to localhost**: `backend/app.py` only allows `http://localhost:3000`. Update `allow_origins` for production deployment.
