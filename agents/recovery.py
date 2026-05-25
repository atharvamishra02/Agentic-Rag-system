import os
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from core.state import AgentState

class RecoveryAgent:
    """
    Self-healing specialist. Diagnoses failures and prescribes fixes.
    """
    def __init__(self, model_name: str = "gpt-4-turbo-preview"):
        self.llm = ChatOpenAI(model=model_name, temperature=0)
        
    async def execute(self, state: AgentState) -> Dict[str, Any]:
        """
        Analyzes the state to determine why the previous step failed.
        Triggers a re-planning phase with specific corrective instructions.
        """
        critique = state.get("critique", "No critique provided.")
        retry_count = state.get("retry_count", {})
        total_retries = retry_count.get("total", 0)
        
        # Analyze failure and generate recovery instructions
        analysis_prompt = f"""
        System failure detected.
        Verifier Critique: {critique}
        Retry Count: {total_retries}
        
        Diagnose the root cause:
        - Is it insufficient retrieval?
        - Is it a reasoning loop?
        - Is it a contradictory source?
        
        Provide a concise 'recovery_instruction' for the Planner to fix this.
        """
        
        response = await self.llm.ainvoke(analysis_prompt)
        instruction = response.content
        
        # Increment retries
        retry_count["total"] = total_retries + 1
        
        return {
            "recovery_instruction": instruction,
            "is_recovering": True,
            "retry_count": retry_count,
            "next_step": "planner"
        }

async def recovery_node(state: AgentState):
    agent = RecoveryAgent()
    return await agent.execute(state)
