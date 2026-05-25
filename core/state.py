from typing import Annotated, List, Dict, Any, Optional, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    The state of the agentic RAG system.
    This structure ensures persistent memory, recovery tracking, and verification status.
    """
    # Core Message History (Stateful across turns)
    messages: Annotated[List[BaseMessage], add_messages]
    
    # Task Planning & Execution
    next_step: str
    plan: List[str]
    current_task_idx: int
    task_dependencies: Dict[str, List[str]]
    
    # Retrieval & Knowledge Grounding
    retrieved_documents: List[Dict[str, Any]]
    verified_claims: List[Dict[str, Any]]
    citations: List[Dict[str, str]]
    
    # Hierarchical Memory Slots
    working_context: Dict[str, Any]
    session_id: str
    episodic_buffer: List[str]  # Short-term summaries of previous steps
    
    # Verification & Quality Control
    confidence_score: float
    is_hallucination: bool
    critique: Optional[str]
    
    # Self-Healing & Fault Tolerance
    retry_count: Dict[str, int]  # Node-specific retry counts
    last_error: Optional[str]
    recovery_instruction: Optional[str]
    is_recovering: bool
    
    # Final Output Synthesis
    final_output: Optional[str]
    trace_id: str
