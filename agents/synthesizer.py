import os
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from core.state import AgentState

class SynthesizerAgent:
    """
    Final response generation agent. Ensures citations and grounding.
    """
    def __init__(self, model_name: str = "gpt-4-turbo-preview"):
        self.llm = ChatOpenAI(model=model_name, temperature=0)
        
    async def execute(self, state: AgentState) -> Dict[str, Any]:
        """
        Synthesizes the final answer using ONLY the verified documents.
        """
        query = state["messages"][-1].content
        docs = state.get("retrieved_documents", [])
        
        system_prompt = """
        You are a HIGH-PRECISION SYNTHESIZER.
        Your goal is to answer the user query based ONLY on the provided context.
        
        STRICT RULES:
        1. Use inline citations like [Source ID].
        2. If the context is insufficient, state that clearly.
        3. Maintain a professional, objective tone.
        4. Include a 'Verification Trace' at the end summarizing why this answer is grounded.
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Query: {query}\n\nVerified Context: {docs}\n\nGenerate the final response.")
        ])
        
        chain = prompt | self.llm
        
        response = await chain.ainvoke({
            "query": query,
            "docs": str(docs)
        })
        
        return {
            "final_output": response.content,
            "next_step": "END"
        }

async def synthesizer_node(state: AgentState):
    agent = SynthesizerAgent()
    return await agent.execute(state)
