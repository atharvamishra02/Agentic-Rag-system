from vector_store import create_vector_store, update_vector_store, load_vector_store
from langchain_core.documents import Document

def test_db():
    print("Testing FAISS update...")
    # 1. Create first doc
    doc1 = Document(page_content="Basketball is a sport with 5 players.", metadata={"source": "basketball.pdf", "thread_id": "123"})
    print("Adding basketball...")
    update_vector_store([doc1])
    
    # 2. Add second doc
    doc2 = Document(page_content="Cricket is a sport with 11 players.", metadata={"source": "cricket.pdf", "thread_id": "123"})
    print("Adding cricket...")
    update_vector_store([doc2])
    
    # 3. Load and check
    store = load_vector_store()
    print("Total docs in store:", len(store.docstore._dict))
    
    # 4. Search
    retriever = store.as_retriever(search_kwargs={"k": 2})
    docs = retriever.invoke("How many players in cricket?")
    print("Retrieved docs:", [d.page_content for d in docs])

if __name__ == "__main__":
    import os, shutil
    if os.path.exists("faiss_db"): shutil.rmtree("faiss_db")
    os.makedirs("faiss_db")
    test_db()
