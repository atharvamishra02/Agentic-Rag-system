
from vector_store import load_vector_store
import os

try:
    db = load_vector_store()
    # Access the docstore to see what's in there
    docstore = db.docstore._dict
    sources = set()
    for doc_id, doc in docstore.items():
        source = doc.metadata.get("source", "Unknown")
        page = doc.metadata.get("page", "No Page")
        sources.add(f"{os.path.basename(source)} (Page: {page})")
    
    print("Found following sources/pages in FAISS DB:")
    for s in sorted(list(sources)):
        print(f" - {s}")
except Exception as e:
    print(f"Error: {e}")
