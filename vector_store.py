import os
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_experimental.text_splitter import SemanticChunker

_embeddings_instance = None

def get_embeddings():
    global _embeddings_instance
    if _embeddings_instance is None:
        print("\n[Embeddings] Initializing all-MiniLM-L6-v2 HuggingFace model...")
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
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
        except ImportError:
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
    Creates a new FAISS vector store. (Overwrites if exists)
    """
    print("\n[Step 3] Creating new vector database...")
    embeddings = get_embeddings()
    vector_store = FAISS.from_documents(chunks, embeddings)
    vector_store.save_local(db_path)
    print(f"Vector database saved to: {db_path}")
    return vector_store

def update_vector_store(chunks, db_path="faiss_db"):
    """
    Adds new chunks to an existing FAISS vector store.
    If no store exists, it creates one.
    """
    if not chunks:
        print("[Update] No chunks to add. Skipping.")
        return None

    embeddings = get_embeddings()
    
    # Check if the database files actually exist inside the directory
    index_file = os.path.join(db_path, "index.faiss")
    
    if os.path.exists(index_file):
        print(f"\n[Update] Loading existing database from {db_path}...")
        vector_store = FAISS.load_local(db_path, embeddings, allow_dangerous_deserialization=True)
        
        # Session-aware deduplication: Check if this source is already indexed FOR THIS SESSION
        first_chunk_metadata = chunks[0].metadata if chunks else {}
        new_source = os.path.basename(first_chunk_metadata.get("source", ""))
        current_thread_id = first_chunk_metadata.get("thread_id")
        
        already_indexed = False
        if hasattr(vector_store, 'docstore') and hasattr(vector_store.docstore, '_dict'):
            for doc_id in vector_store.docstore._dict:
                m = vector_store.docstore._dict[doc_id].metadata
                if os.path.basename(m.get("source", "")) == new_source and m.get("thread_id") == current_thread_id:
                    already_indexed = True
                    break
        
        if already_indexed:
            print(f"   ! Source '{new_source}' already indexed for this session. Skipping.")
            return vector_store
            
        print(f"   -> Adding {len(chunks)} new chunks for session '{current_thread_id or 'Global'}'...")
        vector_store.add_documents(chunks)
    else:
        print(f"\n[Initialization] Creating new database with {len(chunks)} chunks...")
        vector_store = FAISS.from_documents(chunks, embeddings)
    
    # Save back to disk
    vector_store.save_local(db_path)
    print(f"Vector database updated at: {db_path}")
    return vector_store

def load_vector_store(db_path="faiss_db"):
    """
    Loads an existing FAISS vector store.
    """
    index_file = os.path.join(db_path, "index.faiss")
    if not os.path.exists(index_file):
        # We return None instead of throwing an error, so the chat engine can gracefully say "no documents"
        return None
    
    embeddings = get_embeddings()
    
    # allow_dangerous_deserialization is required for loading local FAISS files
    return FAISS.load_local(db_path, embeddings, allow_dangerous_deserialization=True)

def clear_user_data(user_id, db_path="faiss_db"):
    """
    Removes all entries for a specific user from the vector store.
    """
    if not user_id:
        return False
        
    index_file = os.path.join(db_path, "index.faiss")
    if not os.path.exists(index_file):
        return True

    embeddings = get_embeddings()
    vector_store = FAISS.load_local(db_path, embeddings, allow_dangerous_deserialization=True)
    
    # FAISS doesn't have a direct delete_by_metadata, so we filter the docstore
    if hasattr(vector_store, 'docstore') and hasattr(vector_store.docstore, '_dict'):
        ids_to_keep = []
        for doc_id, doc in vector_store.docstore._dict.items():
            if doc.metadata.get("user_id") != user_id:
                ids_to_keep.append(doc_id)
        
        # This is a bit hacky for FAISS local, usually one would recreate or use a different VS
        # But for this implementation, we can filter the docstore and re-save if needed
        # However, a cleaner way is to just filter and save a new index
        all_docs = [vector_store.docstore._dict[did] for did in ids_to_keep]
        if not all_docs:
            if os.path.exists(db_path):
                import shutil
                shutil.rmtree(db_path)
            return True
            
        new_vs = FAISS.from_documents(all_docs, embeddings)
        new_vs.save_local(db_path)
        return True
    return False

if __name__ == "__main__":
    # Test block
    from document_loader import load_document
    
    test_file = "test_docs/cricket_guide.pdf"
    if os.path.exists(test_file):
        docs = load_document(test_file)
        chunks = get_text_chunks(docs)
        create_vector_store(chunks)
        print("\n[SUCCESS] Vector store test complete.")
