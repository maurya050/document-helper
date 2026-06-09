import asyncio
import os
import ssl
from collections.abc import AsyncIterator
from typing import Any, Dict, List

import certifi
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_classic.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone as PineconeClient
from langchain_pinecone import PineconeVectorStore
from langchain_tavily import TavilyCrawl, TavilyExtract, TavilyMap

from .logger import (Colors, log_error, log_header, log_info, log_success,
                     log_warning)

load_dotenv()

# Configure SSL context to use certifi certificates
ssl_context = ssl.create_default_context(cafile=certifi.where())
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()


INDEX_NAME = "langchain-docs-2026"

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    show_progress_bar=False,
    chunk_size=50,
    retry_min_seconds=10,
)
# vectorstore = Chroma(persist_directory="chroma_db", embedding_function=embeddings)
vectorstore = PineconeVectorStore(
    index_name=INDEX_NAME, embedding=embeddings
)
tavily_extract = TavilyExtract()
tavily_map = TavilyMap(max_depth=5, max_breadth=20, max_pages=1000)
tavily_crawl = TavilyCrawl()


async def ingest(url: str) -> AsyncIterator[dict]:
    """Wipe Pinecone index, crawl url, re-index. Yields progress dicts."""
    yield {"type": "progress", "message": "Clearing previous index..."}
    pc = PineconeClient(api_key=os.getenv("PINECONE_API_KEY"))
    await asyncio.to_thread(lambda: pc.Index(INDEX_NAME).delete(delete_all=True))

    yield {"type": "progress", "message": f"Crawling {url} — this may take a few minutes"}
    res = await asyncio.to_thread(
        tavily_crawl.invoke,
        {"url": url, "max_depth": 5, "extract_depth": "advanced"},
    )

    if "error" in res:
        yield {"type": "error", "message": res["error"]}
        return

    all_docs = [
        Document(page_content=r["raw_content"], metadata={"source": r["url"]})
        for r in res["results"]
    ]
    yield {"type": "progress", "message": f"Crawled {len(all_docs)} pages"}

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200)
    splitted_docs = text_splitter.split_documents(all_docs)
    yield {"type": "progress", "message": f"Split into {len(splitted_docs)} chunks"}

    batch_size = 50
    batches = [splitted_docs[i : i + batch_size] for i in range(0, len(splitted_docs), batch_size)]
    for i, batch in enumerate(batches):
        try:
            await vectorstore.aadd_documents(batch)
            yield {"type": "progress", "message": f"Indexed batch {i + 1}/{len(batches)}"}
        except Exception as e:
            yield {"type": "error", "message": f"Batch {i + 1} failed: {e}"}
            return

    yield {"type": "done", "chunks": len(splitted_docs)}


async def index_documents_async(documents: List[Document], batch_size: int = 50):
    """Process documents in batches asynchronously."""
    log_header("VECTOR STORAGE PHASE")
    log_info(
        f"📚 VectorStore Indexing: Preparing to add {len(documents)} documents to vector store",
        Colors.DARKCYAN,
    )

    # Create batches
    batches = [
        documents[i : i + batch_size] for i in range(0, len(documents), batch_size)
    ]

    log_info(
        f"📦 VectorStore Indexing: Split into {len(batches)} batches of {batch_size} documents each"
    )

    # Process all batches concurrently
    async def add_batch(batch: List[Document], batch_num: int):
        try:
            await vectorstore.aadd_documents(batch)
            log_success(
                f"VectorStore Indexing: Successfully added batch {batch_num}/{len(batches)} ({len(batch)} documents)"
            )
        except Exception as e:
            log_error(f"VectorStore Indexing: Failed to add batch {batch_num} - {e}")
            return False
        return True

    # Process batches concurrently
    tasks = [add_batch(batch, i + 1) for i, batch in enumerate(batches)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Count successful batches
    successful = sum(1 for result in results if result is True)

    if successful == len(batches):
        log_success(
            f"VectorStore Indexing: All batches processed successfully! ({successful}/{len(batches)})"
        )
    else:
        log_warning(
            f"VectorStore Indexing: Processed {successful}/{len(batches)} batches successfully"
        )


async def main():
    url = "https://python.langchain.com/"
    async for event in ingest(url):
        if event["type"] == "progress":
            log_info(event["message"])
        elif event["type"] == "done":
            log_success(f"Done! Indexed {event['chunks']} chunks.")
        elif event["type"] == "error":
            log_error(event["message"])


if __name__ == "__main__":
    asyncio.run(main())