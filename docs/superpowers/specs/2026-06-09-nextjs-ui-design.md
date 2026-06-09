# Next.js UI + Backend Cleanup — Design Spec
Date: 2026-06-09

## Overview

Add a Next.js 14 + TypeScript frontend to the document-helper RAG chatbot, expose a FastAPI backend with streaming endpoints, and reorganize the existing Python files into a clean `backend/` structure. Users paste a documentation URL, watch it get crawled and indexed live, then ask questions in a streaming chat interface with inline source citations.

---

## Repo Structure

```
document-helper/
├── backend/
│   ├── app.py           # FastAPI server (new)
│   ├── core.py          # RAG pipeline (unchanged)
│   ├── ingestion.py     # moved from root
│   └── logger.py        # moved from root
├── frontend/            # Next.js 14 app (new)
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx
│   │   └── components/
│   │       ├── UrlInput.tsx
│   │       ├── ChatWindow.tsx
│   │       ├── MessageBubble.tsx
│   │       ├── SourceCitation.tsx
│   │       └── ChatInput.tsx
│   ├── package.json
│   └── tsconfig.json
├── pyproject.toml
├── uv.lock
└── .gitignore
```

**Removed:** `main.py` (unused placeholder).

**Updated imports:** `ingestion.py` switches to `from .logger import ...` (relative import). A `backend/__init__.py` is added to make `backend/` a proper package. Run ingestion as `python -m backend.ingestion` from the project root. `core.py` is unaffected.

---

## Backend

### `backend/app.py` — FastAPI server

Two endpoints, CORS enabled for `http://localhost:3000`.

#### `POST /ingest`
- Body: `{ "url": string }`
- Streams SSE progress events while Tavily crawls and Pinecone indexes
- Event types:
  ```
  data: {"type": "progress", "message": "Crawling https://..."}
  data: {"type": "progress", "message": "Indexed 47 chunks"}
  data: {"type": "done", "chunks": 284}
  data: {"type": "error", "message": "..."}
  ```
- Calls the ingestion pipeline logic from `ingestion.py` (extracted into a callable function)
- **Wipes the Pinecone index before indexing** (`delete_all()`) — each ingestion replaces the previous document entirely

#### `POST /chat`
- Body: `{ "query": string }`
- Streams SSE response using LangGraph `astream_events` from `core.py`
- Event types:
  ```
  data: {"type": "token", "content": "LangChain"}
  data: {"type": "sources", "sources": ["https://...", "https://..."]}
  data: {"type": "done"}
  data: {"type": "error", "message": "..."}
  ```

### `backend/core.py` — changes
Add `run_llm_stream(query: str)` as an async generator alongside the existing `run_llm`. The existing function stays untouched.

### `backend/ingestion.py` — changes
Extract the core crawl+index logic into a callable `async def ingest(url: str)` function so `app.py` can call it. The `if __name__ == "__main__"` block continues to work as before.

---

## Frontend

### Theme
Light theme. White backgrounds, `#0969da` blue for primary actions, `#2da44e` green for success/sources, `#f6f8fa` for secondary surfaces.

### Two-step flow

**Step 1 — URL Input (`UrlInput.tsx`)**
- Prominent URL input field with "Go →" button
- Quick-pick chips: `python.langchain.com`, `docs.anthropic.com` (pre-fill input on click)
- On submit: calls `POST /ingest`, reads SSE stream
- Live status bar animates at the bottom: "Crawling... 47 pages found so far"
- On `done` event: auto-transitions to Step 2
- On `error` event: shows inline error, stays on Step 1

**Step 2 — Chat (`ChatWindow.tsx`)**
- Full-screen chat, light theme
- Auto-scrolls to latest message
- "New document" button top-right: clears message history and returns to Step 1

**`MessageBubble.tsx`**
- User messages: right-aligned, blue bubble
- Assistant messages: left-aligned, white card with grey border
- During streaming: text renders token-by-token in place
- After stream: `SourceCitation` appended below

**`SourceCitation.tsx`**
- Collapsible "📎 N sources" toggle below each assistant answer
- Expands to show list of clickable URLs

**`ChatInput.tsx`**
- Textarea (auto-grows up to 4 lines) + send button
- Disabled and greyed out while streaming
- Send on Enter (Shift+Enter for newline)

### State management (`page.tsx`)
```ts
type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  sources: string[]
  streaming: boolean
}

const [step, setStep] = useState<"ingest" | "chat">("ingest")
const [messages, setMessages] = useState<Message[]>([])
const [isStreaming, setIsStreaming] = useState(false)
```

No external state library. All state in `page.tsx`, passed as props.

---

## Data Flow

```
User pastes URL
  → UrlInput calls POST /ingest
  → FastAPI streams progress SSE
  → UrlInput shows live status
  → On done → setStep("chat")

User types query
  → ChatInput calls POST /chat
  → FastAPI streams token SSE via astream_events
  → MessageBubble updates content in place per token
  → On sources event → store sources on message
  → On done → setIsStreaming(false), show SourceCitation
```

---

## Error Handling

- Ingest errors: shown inline on Step 1, user can retry
- Chat errors: shown as an error message bubble in chat
- Network failures: caught in fetch, surface as error messages
- Backend never crashes the stream — always emits `{"type": "error", ...}` then closes

---

## Environment Variables

```
# .env (backend)
OPENAI_API_KEY=
PINECONE_API_KEY=
TAVILY_API_KEY=

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```
