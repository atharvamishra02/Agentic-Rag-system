from typing import Literal
from langgraph.graph import StateGraph, END
from core.state import AgentState

# Import actual node functions
from agents.planner import planner_node
from agents.retrieval import retrieval_node
from agents.verifier import verification_node
from agents.recovery import recovery_node
from agents.synthesizer import synthesizer_node

# Define the Routing Logic
def route_after_verification(state: AgentState) -> Literal["recovery", "synthesizer"]:
    if state.get("is_hallucination") or state.get("confidence_score", 0) < 0.7:
        return "recovery"
    return "synthesizer"

def route_after_recovery(state: AgentState) -> Literal["planner", "END"]:
    if state.get("retry_count", {}).get("total", 0) > 3:
        return END
    return "planner"

# Build the Graph
builder = StateGraph(AgentState)

# Add Nodes
builder.add_node("planner", planner_node)
builder.add_node("retriever", retrieval_node)
builder.add_node("verifier", verification_node)
builder.add_node("recovery", recovery_node)
builder.add_node("synthesizer", synthesizer_node)

# Set Entry Point
builder.set_entry_point("planner")

# Add Edges
builder.add_edge("planner", "retriever")
builder.add_edge("retriever", "verifier")

# Conditional Edges
builder.add_conditional_edges(
    "verifier",
    route_after_verification,
    {
        "recovery": "recovery",
        "synthesizer": "synthesizer"
    }
)

builder.add_conditional_edges(
    "recovery",
    route_after_recovery,
    {
        "planner": "planner",
        "END": END
    }
)

builder.add_edge("synthesizer", END)

# Compile Graph
graph = builder.compile()
