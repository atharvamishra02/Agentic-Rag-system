import os
import pickle
from langchain_core.vectorstores import InMemoryVectorStore

class InMemoryVectorStoreWithDictFilter(InMemoryVectorStore):
    def _convert_filter(self, filter_dict):
        if not filter_dict:
            return None
        if callable(filter_dict):
            return filter_dict
        # If it is a dictionary, convert it to a lambda function
        return lambda doc: all(doc.metadata.get(k) == v for k, v in filter_dict.items())

    def similarity_search_with_score_by_vector(self, embedding, k=4, filter=None, **kwargs):
        filter_func = self._convert_filter(filter)
        return super().similarity_search_with_score_by_vector(embedding, k=k, filter=filter_func, **kwargs)

    def max_marginal_relevance_search_by_vector(self, embedding, k=4, fetch_k=20, lambda_mult=0.5, filter=None, **kwargs):
        filter_func = self._convert_filter(filter)
        return super().max_marginal_relevance_search_by_vector(embedding, k=k, fetch_k=fetch_k, lambda_mult=lambda_mult, filter=filter_func, **kwargs)

    def similarity_search(self, query, k=4, filter=None, **kwargs):
        filter_func = self._convert_filter(filter)
        return super().similarity_search(query, k=k, filter=filter_func, **kwargs)

_embeddings_instance = None

def get_embeddings():
    global _embeddings_instance
    if _embeddings_instance is None:
        openai_key = os.getenv("OPENAI_API_KEY")
        disable_openai = os.getenv("DISABLE_OPENAI_EMBEDDINGS", "false").lower() == "true"
        
        if openai_key and not disable_openai:
            print("\n[Embeddings] Initializing OpenAIEmbeddings (text-embedding-3-small) to prevent VPS OOM...")
            from langchain_openai import OpenAIEmbeddings
            _embeddings_instance = OpenAIEmbeddings(model="text-embedding-3-small")
        else:
            print("\n[Embeddings] Initializing all-MiniLM-L6-v2 HuggingFace model...")
            from langchain_huggingface import HuggingFaceEmbeddings
            _embeddings_instance = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return _embeddings_instance

def get_text_chunks(documents, thread_id=None, file_url=None, user_id=None):
    """
    Splits the loaded documents using Semantic Chunking (Industry Level).
    This breaks text based on meaning shifts rather than fixed character counts.
    Falls back to RecursiveCharacterTextSplitter if it fails or if the document is too large
    to prevent memory/CPU OOM crashes in resource-constrained environments.
    """
    print(f"\n[Step 2] Chunking {len(documents)} document pages...")
    
    chunks = []
    use_semantic = True
    
    # If the document has a large number of pages, force Recursive splitting to avoid OOM
    if len(documents) > 15:
        print(f"   [Chunker] Document has {len(documents)} pages. Using Recursive splitter to prevent OOM crash.")
        use_semantic = False
        
    if use_semantic:
        try:
            embeddings = get_embeddings()
            from langchain_experimental.text_splitter import SemanticChunker
            text_splitter = SemanticChunker(
                embeddings, 
                breakpoint_threshold_type="percentile" 
            )
            chunks = text_splitter.split_documents(documents)
            print(f"   [Chunker] Successfully split into {len(chunks)} chunks using Semantic Chunker.")
        except Exception as e:
            print(f"   [Chunker Warning] Semantic chunking failed ({e}). Falling back to RecursiveCharacterTextSplitter.")
            use_semantic = False
            
    if not use_semantic:
        from langchain.text_splitter import RecursiveCharacterTextSplitter

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = text_splitter.split_documents(documents)
        print(f"   [Chunker] Successfully split into {len(chunks)} chunks using Recursive Chunker.")
    
    # Inject metadata for all chunks if provided
    for chunk in chunks:
        if thread_id:
            chunk.metadata["thread_id"] = thread_id
        if file_url:
            chunk.metadata["file_url"] = file_url
        if user_id:
            chunk.metadata["user_id"] = user_id
            
    print(f"Created {len(chunks)} text chunks (Session: {thread_id or 'Global'}, User: {user_id or 'None'}).")
    return chunks

def create_vector_store(chunks, db_path="faiss_db"):
    """
    Creates a new vector store. (Overwrites if exists)
    """
    print("\n[Step 3] Creating new vector database...")
    embeddings = get_embeddings()
    vector_store = InMemoryVectorStoreWithDictFilter.from_documents(chunks, embeddings)
    
    os.makedirs(db_path, exist_ok=True)
    pkl_file = os.path.join(db_path, "index.pkl")
    with open(pkl_file, "wb") as f:
        pickle.dump(vector_store.store, f)
    
    # Write a dummy index.faiss file for compatibility checks
    index_file = os.path.join(db_path, "index.faiss")
    with open(index_file, "w") as f:
        f.write("in-memory-compatibility-file")
        
    print(f"Vector database saved to: {db_path}")
    return vector_store

def update_vector_store(chunks, db_path="faiss_db"):
    """
    Adds new chunks to an existing vector store.
    If no store exists, it creates one.
    """
    if not chunks:
        print("[Update] No chunks to add. Skipping.")
        return None

    embeddings = get_embeddings()
    index_file = os.path.join(db_path, "index.faiss")
    pkl_file = os.path.join(db_path, "index.pkl")
    
    if os.path.exists(index_file) and os.path.exists(pkl_file):
        try:
            print(f"\n[Update] Loading existing database from {db_path}...")
            with open(pkl_file, "rb") as f:
                store_dict = pickle.load(f)
            vector_store = InMemoryVectorStoreWithDictFilter(embeddings)
            vector_store.store = store_dict
            
            # Session-aware deduplication: Check if this source is already indexed FOR THIS SESSION
            first_chunk_metadata = chunks[0].metadata if chunks else {}
            new_source = os.path.basename(first_chunk_metadata.get("source", ""))
            current_thread_id = first_chunk_metadata.get("thread_id")
            
            already_indexed = False
            for doc_id, doc in vector_store.store.items():
                m = doc.metadata
                if os.path.basename(m.get("source", "")) == new_source and m.get("thread_id") == current_thread_id:
                    already_indexed = True
                    break
            
            if already_indexed:
                print(f"   ! Source '{new_source}' already indexed for this session. Skipping.")
                return vector_store
                
            print(f"   -> Adding {len(chunks)} new chunks for session '{current_thread_id or 'Global'}'...")
            vector_store.add_documents(chunks)
        except Exception as load_err:
            print(f"   [Update Warning] Failed to load existing database ({load_err}). Recreating database to self-heal.")
            vector_store = InMemoryVectorStoreWithDictFilter.from_documents(chunks, embeddings)
    else:
        print(f"\n[Initialization] Creating new database with {len(chunks)} chunks...")
        vector_store = InMemoryVectorStoreWithDictFilter.from_documents(chunks, embeddings)
    
    os.makedirs(db_path, exist_ok=True)
    with open(pkl_file, "wb") as f:
        pickle.dump(vector_store.store, f)
        
    with open(index_file, "w") as f:
        f.write("in-memory-compatibility-file")
        
    print(f"Vector database updated at: {db_path}")
    return vector_store

def load_vector_store(db_path="faiss_db"):
    """
    Loads an existing vector store.
    """
    index_file = os.path.join(db_path, "index.faiss")
    pkl_file = os.path.join(db_path, "index.pkl")
    if not os.path.exists(index_file) or not os.path.exists(pkl_file):
        return None
    
    try:
        embeddings = get_embeddings()
        with open(pkl_file, "rb") as f:
            store_dict = pickle.load(f)
        vector_store = InMemoryVectorStoreWithDictFilter(embeddings)
        vector_store.store = store_dict
        return vector_store
    except Exception as e:
        print(f"[Error] Failed to load local vector store: {e}. Returning None.")
        return None

def clear_user_data(user_id, db_path="faiss_db"):
    """
    Removes all entries for a specific user from the vector store.
    """
    if not user_id:
        return False
        
    index_file = os.path.join(db_path, "index.faiss")
    pkl_file = os.path.join(db_path, "index.pkl")
    if not os.path.exists(index_file) or not os.path.exists(pkl_file):
        return True

    try:
        embeddings = get_embeddings()
        with open(pkl_file, "rb") as f:
            store_dict = pickle.load(f)
            
        ids_to_keep = []
        for doc_id, doc in store_dict.items():
            if doc.metadata.get("user_id") != user_id:
                ids_to_keep.append(doc_id)
                
        if not ids_to_keep:
            if os.path.exists(db_path):
                import shutil
                shutil.rmtree(db_path)
            return True
            
        new_store = {did: store_dict[did] for did in ids_to_keep}
        
        with open(pkl_file, "wb") as f:
            pickle.dump(new_store, f)
        return True
    except Exception as e:
        print(f"[Error] Failed to clear user data: {e}")
        return False
