import os
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from core.state import AgentState

class PlannerAgent:
    def __init__(self, model_name: str = "gpt-4-turbo-preview"):
        self.llm = ChatOpenAI(model=model_name, temperature=0)
        self.parser = JsonOutputParser()
        
    async def execute(self, state: AgentState) -> Dict[str, Any]:
        """
        Decomposes the user request into a step-by-step execution plan.
        If in recovery mode, it adjusts the plan based on the failure context.
        """
        messages = state.get("messages", [])
        last_error = state.get("last_error")
        is_recovering = state.get("is_recovering", False)
        recovery_instruction = state.get("recovery_instruction")
        
        system_prompt = """
        You are the MASTER STRATEGIST of a production-grade Agentic RAG system.
        Your goal is to decompose complex user queries into a sequence of atomic, verifiable tasks.
        
        STRICT RULES:
        1. Break down queries into retrieval tasks, verification tasks, and synthesis tasks.
        2. If 'recovery_instruction' is provided, you MUST adapt the strategy to avoid the previous failure.
        3. Output MUST be valid JSON with 'plan' (list of strings) and 'reasoning'.
        4. Focus on multi-hop retrieval if the query requires connecting disparate facts.
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("placeholder", "{messages}"),
            ("human", "Failure context (if any): {error}\nRecovery instructions: {instruction}\nGenerate the optimal execution plan.")
        ])
        
        chain = prompt | self.llm | self.parser
        
        result = await chain.ainvoke({
            "messages": messages,
            "error": last_error or "None",
            "instruction": recovery_instruction or "Initial planning phase."
        })
        
        # Update plan in state
        return {
            "plan": result["plan"],
            "current_task_idx": 0,
            "is_recovering": False, # Reset recovery flag once re-planned
            "next_step": "retriever"
        }

# Function to be used in the graph
async def planner_node(state: AgentState):
    agent = PlannerAgent()
    return await agent.execute(state)
