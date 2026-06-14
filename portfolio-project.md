# Document Helper — Portfolio Project

## Project Summary

A full-stack RAG (Retrieval-Augmented Generation) app that turns any documentation site into an interactive Q&A assistant. Point it at a docs URL, it crawls and indexes the content, then lets you chat with it in real time.

**Live Demo**: [your-app.vercel.app](https://your-app.vercel.app) ← update after deploy  
**GitHub**: [github.com/yourusername/document-helper](https://github.com/yourusername/document-helper) ← update  

---

## What It Does

1. **Ingest a URL** — paste any documentation site (e.g. `python.langchain.com`). The app crawls it using Tavily's advanced extraction, splits the content into chunks, and indexes everything into a Pinecone vector store.

2. **Ask questions** — type a question and get a streamed answer grounded in the docs, with source citations.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI, Python 3.11, uvicorn |
| AI / LLM | OpenAI GPT-5 (`gpt-5.2`), `text-embedding-3-small` |
| Vector DB | Pinecone (serverless) |
| Crawling | Tavily Crawl API (advanced extraction) |
| RAG Framework | LangChain (agents, `astream_events`) |
| Deployment | Railway (backend) + Vercel (frontend) |

---

## Key Technical Highlights

- **Streaming end-to-end** — backend uses FastAPI `StreamingResponse` + LangChain `astream_events v2`; frontend consumes SSE line-by-line so tokens appear in real time.
- **Agentic retrieval** — LangChain agent with a `retrieve_context` tool; the model decides when to call it rather than always doing a lookup.
- **Source citations** — tool messages carry `artifact` (list of `Document` objects); sources are extracted and surfaced in the chat UI.
- **Stateless ingest** — each ingest wipes the Pinecone namespace and re-indexes, so the assistant always reflects the latest docs.
- **Async batched indexing** — documents are added to Pinecone in parallel batches of 50 for fast ingestion of large sites (1 000+ pages).

---

## Architecture

```
Browser (Next.js)
    │
    ├── POST /ingest  →  Tavily Crawl → chunk → Pinecone upsert (SSE progress)
    └── POST /chat    →  Pinecone retrieval → GPT-5 agent → streamed tokens + sources
                                FastAPI (Railway)
```

---

## Running Locally

```bash
# Backend
cp .env.example .env          # fill in API keys
uv sync
uvicorn backend.app:app --reload

# Frontend (separate terminal)
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Then open http://localhost:3000.

---

## Environment Variables

**Backend** (Railway):
| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `PINECONE_API_KEY` | Pinecone API key |
| `TAVILY_API_KEY` | Tavily API key |
| `FRONTEND_URL` | Vercel frontend URL (for CORS) |

**Frontend** (Vercel):
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Railway backend URL |
