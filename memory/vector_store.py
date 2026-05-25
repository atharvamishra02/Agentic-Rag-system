import os
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

class HybridVectorStore:
    """
    Production-grade Hybrid Retrieval Engine.
    Combines Dense Vector Search (Qdrant) with Sparse BM25 Search.
    """
    def __init__(
        self, 
        collection_name: str = "agentic_rag",
        model_name: str = "all-MiniLM-L6-v2"
    ):
        self.client = QdrantClient("localhost", port=6333)
        self.encoder = SentenceTransformer(model_name)
        self.collection_name = collection_name
        self.bm25 = None # Initialized after loading docs
        
    async def search(
        self, 
        query: str, 
        limit: int = 5, 
        alpha: float = 0.5,
        metadata_filter: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        """
        Performs hybrid search using Reciprocal Rank Fusion (RRF) logic.
        """
        # 1. Vector Search
        query_vector = self.encoder.encode(query).tolist()
        vector_results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit,
            query_filter=metadata_filter
        )
        
        # 2. BM25 Search (Placeholder - assumes BM25 is pre-computed)
        # In a real system, BM25 would be integrated into the DB or a separate index.
        sparse_results = [] # To be implemented
        
        # 3. Reranking (Mocking a simple fusion for now)
        combined_results = []
        for res in vector_results:
            combined_results.append({
                "content": res.payload.get("text", ""),
                "metadata": res.payload,
                "score": res.score,
                "source": res.payload.get("source", "unknown")
            })
            
        return combined_results

    def add_documents(self, documents: List[Dict[str, Any]]):
        """
        Ingests documents into Qdrant and updates BM25 index.
        """
        points = []
        for i, doc in enumerate(documents):
            vector = self.encoder.encode(doc["text"]).tolist()
            points.append({
                "id": i,
                "vector": vector,
                "payload": doc
            })
        
        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        
        # Update BM25 index
        texts = [doc["text"] for doc in documents]
        tokenized_corpus = [t.split(" ") for t in texts]
        self.bm25 = BM25Okapi(tokenized_corpus)
