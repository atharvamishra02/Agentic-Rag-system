import os
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from core.state import AgentState

class VerificationAgent:
    """
    Strictest agent in the system. Responsible for blocking hallucinations.
    """
    def __init__(self, model_name: str = "gpt-4-turbo-preview"):
        self.llm = ChatOpenAI(model=model_name, temperature=0)
        self.parser = JsonOutputParser()
        
    async def execute(self, state: AgentState) -> Dict[str, Any]:
        """
        Validates the retrieved documents against the original query and internal reasoning.
        """
        query = state["messages"][-1].content
        docs = state.get("retrieved_documents", [])
        
        system_prompt = """
        You are a RUTHLESS FACT-CHECKER.
        Your task is to verify if the retrieved context is SUFFICIENT and ACCURATE to answer the user query.
        
        STRICT RULES:
        1. If any part of the query cannot be answered by the documents, mark 'is_hallucination': true.
        2. Assign a 'confidence_score' (0.0 to 1.0).
        3. Identify 'missing_information' if applicable.
        4. Detect 'contradictions' between multiple retrieved documents.
        5. Output MUST be valid JSON.
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Query: {query}\n\nRetrieved Documents: {docs}\n\nPerform validation.")
        ])
        
        chain = prompt | self.llm | self.parser
        
        result = await chain.ainvoke({
            "query": query,
            "docs": str(docs)
        })
        
        return {
            "confidence_score": result.get("confidence_score", 0),
            "is_hallucination": result.get("is_hallucination", False),
            "critique": result.get("critique", ""),
            "is_recovering": result.get("is_hallucination", False) # Trigger recovery if hallucination
        }

async def verification_node(state: AgentState):
    agent = VerificationAgent()
    return await agent.execute(state)
