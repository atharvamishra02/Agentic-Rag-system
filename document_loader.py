import os
from langchain_community.document_loaders import PyPDFLoader, TextLoader

def load_document(file_path: str):
    """
    Loads a document based on its extension (supports .pdf and .txt).
    
    Args:
        file_path (str): The path to the file.
        
    Returns:
        List[Document]: A list of LangChain Document objects containing the extracted text and metadata.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File does not exist: {file_path}")

    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    print(f"Parsing document: {file_path}")
    
    if ext == '.pdf':
        # Use PyPDFLoader to extract text from PDF files
        loader = PyPDFLoader(file_path)
        documents = loader.load()
    elif ext in ['.txt', '.md']:
        # Use TextLoader for plain text or markdown files
        loader = TextLoader(file_path, encoding='utf-8')
        documents = loader.load()
    else:
        raise ValueError(f"Unsupported file format: {ext}. Only PDF and Text files are supported in this phase.")
        
    print(f"Successfully loaded {len(documents)} page(s)/section(s) from {file_path}")
    return documents

