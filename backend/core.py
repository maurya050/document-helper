import os
from typing import Any, Dict

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain.messages import ToolMessage
from langchain.tools import tool
from langchain_pinecone import PineconeSparseVectorStore
from langchain_openai import OpenAIEmbeddings

load_dotenv()

#Intialize embeddings (same as ingestion.py )
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

#Initialize the Vector Store

vectorestore = PineconeSparseVectorStore(
    index_name="langchain-docs-2026", embedding=embeddings
)

#Initialize the chat model
model = init_chat_model("gpt-5.2", model_provider="openai")

@tool(response_format="content_and_artifact")
def retrieve_context(query: str):
    """Retrieve relevent documentation to help answer user queries about Langchain."""
    retrieved_docs = vectorestore.as_retriever().invoke(query, k=4)

    #Serialized documents for the model
    serialized = "\n\n".join(
        (f"Source: {doc.metadata.get('source', 'Unknown')}\n\nContent:{doc.page_content}")
        for doc in retrieved_docs
    )

    #Return both serialized content and raw documents
    return serialized, retrieved_docs


def run_llm(query: str)-> Dict[str, Any]:

    """
    Run the RAGpipeline to answer a query using retrieved documentation.

    Args:
        query: The user's questioin
    
    Returns:
        Dictionary containing:
            - answer : The generated answer
            - context: List of retrieved documents.
    """

    #Create the agent with retrieval tool
    system_prompt = (
        "You are a helpful AI assistant that answer question about LangChain documentation"
    )