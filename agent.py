import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langgraph.prebuilt import create_react_agent
from rag_engine import answer_query

# Load environment variables
print("  Loading .env...")
load_dotenv()

def local_research(query: str, thread_id: str = None) -> dict:
    """Search the local research documents and PDFs. Returns full result dict with metadata."""
    result = answer_query(query, thread_id=thread_id)
    response = result["answer"]
    
    if result.get("citations"):
        response += "\n\n--- SOURCES & SNIPPETS ---"
        for cite in result["citations"]:
            # Display source name and all relevant pages
            pages_str = ", ".join(map(str, cite["pages"]))
            url_str = f" | [View Original]({cite['url']})" if cite.get("url") else ""
            response += f"\n[Source {cite['id']}] {cite['source']} (Pages: {pages_str}){url_str}"
            
            # Display all gathered snippets for this source
            for snippet in cite.get("snippets", []):
                response += f'\n   > "{snippet}"'
            response += "\n"
    
    return {
        "text": response,
        "confidence": result.get("confidence"),
        "faithfulness": result.get("faithfulness"),
        "relevancy": result.get("relevancy"),
        "citations": result.get("citations", []),
        "evidence": result.get("evidence", [])
    }

def summarize_document(topic: str, thread_id: str = None) -> dict:
    """Provides a high-level summary of a specific topic or an entire document from the local library."""
    return local_research(f"Provide a comprehensive high-level summary of: {topic}", thread_id=thread_id)

def extract_key_points(topic: str, thread_id: str = None) -> dict:
    """Extracts the most important technical facts, dates, or data points about a topic from local documents."""
    return local_research(f"Extract only the key technical facts and bullet points about: {topic}", thread_id=thread_id)

def compare_documents(comparison_query: str, thread_id: str = None) -> dict:
    """Use this when the user wants to compare two or more things, documents, or topics found in the local library."""
    return local_research(f"Perform a detailed comparison and highlight differences for: {comparison_query}", thread_id=thread_id)

def web_search(query: str) -> str:
    """Search the internet for current information NOT found in local documents."""
    search = DuckDuckGoSearchRun()
    return search.run(query)

from typing import Literal, Any
from pydantic import BaseModel, Field

# --- INTENT DETECTION SCHEMA ---
class Intent(BaseModel):
    """Detects the user's goal to route to the correct flow."""
    category: Literal["qa", "summarize", "compare", "web"] = Field(
        description="The category of the request."
    )

from langgraph.checkpoint.memory import MemorySaver

# --- INTENT DETECTION ---
def detect_intent(messages: list) -> str:
    """Uses LLM to classify intent, now considering conversation history."""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    structured_llm = llm.with_structured_output(Intent)
    
    # Provide history for context-aware intent detection
    history = "\n".join([f"{m.type}: {m.content}" for m in messages[-5:]])
    
    system_prompt = (
        f"CHAT HISTORY:\n{history}\n\n"
        "Classify the user's latest intent. Even if the last message is short (e.g., 'compare them'), "
        "use the history to understand the intent."
        "\n- 'summarize': Overview or summary."
        "\n- 'compare': Differences or similarities."
        "\n- 'web': Current events or general knowledge outside documents."
        "\n- 'qa': Specific questions about the local documents."
    )
    
    try:
        intent = structured_llm.invoke(system_prompt)
        return intent.category
    except Exception:
        return "qa"

from typing import Annotated, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

# --- LANGGRAPH STATE ---
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    intent: str
    contextualized_query: str
    thread_id: str
    rag_metadata: dict  # Carries evidence, faithfulness, relevancy, citations

# --- LANGGRAPH NODES ---
def intent_detector_node(state: AgentState):
    """Node 1: Detects intent using message history."""
    print("\n[LangGraph] Node: INTENT DETECTOR")
    intent = detect_intent(state["messages"])
    print(f"   -> Contextual Intent: {intent.upper()}")
    return {"intent": intent}

def contextualize_query_node(state: AgentState):
    """Node 2: Transforms simple queries into high-quality research prompts."""
    print("[LangGraph] Node: CONTEXTUALIZER (Query Expansion)")
    llm = ChatOpenAI(model="gpt-4o", temperature=0.2) # Use gpt-4o for better expansion
    
    history = "\n".join([f"{m.type}: {m.content}" for m in state["messages"][-5:-1]])
    query = state["messages"][-1].content
    
    prompt = (
        "You are an Expert Research Planner. Your task is to transform a simple user query into a COMPREHENSIVE, HIGH-QUALITY RESEARCH PROMPT.\n\n"
        f"CONVERSATION HISTORY:\n{history}\n\n"
        f"USER'S LATEST QUERY: {query}\n\n"
        "GOAL: Expand the query into a detailed prompt that will yield the best possible context from a RAG system.\n"
        "- If the user is asking a simple follow-up (e.g., 'why?'), expand it to include the specific topic they were discussing.\n"
        "- If the user is asking for a summary, specify what aspects should be covered (e.g., methodology, results, implications).\n"
        "- Maintain the core intent but make it professionally articulated and broad enough to capture related relevant chunks.\n\n"
        "Return ONLY the expanded research prompt text."
    )
    
    expanded_query = llm.invoke(prompt).content
    print(f"   -> Expanded Research Prompt: {expanded_query}")
    return {"contextualized_query": expanded_query}

def qa_node(state: AgentState):
    """Node 3A: Handles General QA"""
    print("[LangGraph] Node: QA FLOW")
    query = state["contextualized_query"]
    thread_id = state.get("thread_id")
    result = local_research(query, thread_id=thread_id)
    return {
        "messages": [("assistant", result["text"])],
        "rag_metadata": {
            "confidence": result.get("confidence"),
            "faithfulness": result.get("faithfulness"),
            "relevancy": result.get("relevancy"),
            "citations": result.get("citations", []),
            "evidence": result.get("evidence", [])
        }
    }

def summarize_node(state: AgentState):
    """Node 3B: Handles Summarization"""
    print("[LangGraph] Node: SUMMARIZATION FLOW")
    query = state["contextualized_query"]
    thread_id = state.get("thread_id")
    result = summarize_document(query, thread_id=thread_id)
    return {
        "messages": [("assistant", result["text"])],
        "rag_metadata": {
            "confidence": result.get("confidence"),
            "faithfulness": result.get("faithfulness"),
            "relevancy": result.get("relevancy"),
            "citations": result.get("citations", []),
            "evidence": result.get("evidence", [])
        }
    }

def compare_node(state: AgentState):
    """Node 3C: Handles Comparison"""
    print("[LangGraph] Node: COMPARISON FLOW")
    query = state["contextualized_query"]
    thread_id = state.get("thread_id")
    result = compare_documents(query, thread_id=thread_id)
    return {
        "messages": [("assistant", result["text"])],
        "rag_metadata": {
            "confidence": result.get("confidence"),
            "faithfulness": result.get("faithfulness"),
            "relevancy": result.get("relevancy"),
            "citations": result.get("citations", []),
            "evidence": result.get("evidence", [])
        }
    }

def web_node(state: AgentState):
    """Node 3D: Handles Web Search"""
    print("[LangGraph] Node: WEB SEARCH FLOW")
    query = state["contextualized_query"]
    response = web_search(query)
    return {
        "messages": [("assistant", response)],
        "rag_metadata": {}
    }

# --- ROUTER FUNCTION ---
def route_intent(state: AgentState):
    return state["intent"]

# --- COMPILE THE GRAPH ---
def build_graph():
    print("\n[Step 7] Compiling Context-Aware LangGraph...")
    workflow = StateGraph(AgentState)

    workflow.add_node("intent_detector", intent_detector_node)
    workflow.add_node("contextualizer", contextualize_query_node)
    workflow.add_node("qa", qa_node)
    workflow.add_node("summarize", summarize_node)
    workflow.add_node("compare", compare_node)
    workflow.add_node("web", web_node)

    # FLOW: Start -> Intent -> Contextualize -> (Route to Flow)
    workflow.add_edge(START, "intent_detector")
    workflow.add_edge("intent_detector", "contextualizer")

    workflow.add_conditional_edges("contextualizer", route_intent, {
        "qa": "qa", "summarize": "summarize", "compare": "compare", "web": "web"
    })
    
    workflow.add_edge("qa", END)
    workflow.add_edge("summarize", END)
    workflow.add_edge("compare", END)
    workflow.add_edge("web", END)

    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)

# Global compiled graph with memory
app = build_graph()

def run_agent(query: str, thread_id: str = "default_session") -> dict:
    """
    Executes the LangGraph flow with persistent session and context awareness.
    Returns a dict with 'response', 'confidence', 'faithfulness', 'relevancy', 'citations', 'evidence'.
    """
    print(f"\n==========================================")
    print(f"      PHASE 7: CONTEXT-AWARE ASSISTANT")
    print(f"      SESSION ID: {thread_id}")
    print(f"==========================================")
    
    config = {"configurable": {"thread_id": thread_id}}
    result = app.invoke({
        "messages": [("user", query)],
        "thread_id": thread_id
    }, config=config)
    
    metadata = result.get("rag_metadata", {})
    
    return {
        "response": result["messages"][-1].content,
        "confidence": metadata.get("confidence"),
        "faithfulness": metadata.get("faithfulness"),
        "relevancy": metadata.get("relevancy"),
        "citations": metadata.get("citations", []),
        "evidence": metadata.get("evidence", [])
    }

if __name__ == "__main__":
    if os.getenv("OPENAI_API_KEY"):
        print(run_agent("Summarize the basketball guide"))
