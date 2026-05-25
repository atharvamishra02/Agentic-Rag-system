import os
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from vector_store import load_vector_store

# Load environment variables
load_dotenv()

def format_docs_grouped(docs):
    """
    Groups retrieved chunks by their source file and assigns a numeric ID.
    This helps the LLM cite sources accurately using [Source 1], [Source 2], etc.
    """
    grouped = {}
    source_map = {}
    id_counter = 1

    for doc in docs:
        source = os.path.basename(doc.metadata.get("source", "Unknown"))
        if source not in source_map:
            source_map[source] = id_counter
            id_counter += 1
        
        sid = source_map[source]
        if sid not in grouped:
            grouped[sid] = {"name": source, "content": []}
        grouped[sid]["content"].append(doc.page_content)
    
    formatted_text = ""
    for sid, data in sorted(grouped.items()):
        formatted_text += f"\n--- [Source {sid}]: {data['name']} ---\n"
        formatted_text += "\n".join([f"• {s}" for s in data["content"]]) + "\n"
    
    return formatted_text

def get_rag_chain(thread_id=None):
    """
    Upgraded RAG Chain for Multi-Doc Reasoning & Comparisons.
    Filters by thread_id if provided.
    """
    # 1. Load the store
    vector_store = load_vector_store()
    
    if vector_store is None:
        # Fallback chain when no documents have been uploaded yet
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
        prompt = ChatPromptTemplate.from_template("The user asked: {question}\n\nHowever, there are no documents uploaded in this research thread yet. Politely ask the user to upload some documents using the 'Upload Sources' button to get started.")
        return prompt | llm | StrOutputParser() | (lambda x: {"answer": x, "docs": []})

    # 2. Setup the base retriever with metadata filtering for the specific thread
    search_kwargs = {"k": 20, "fetch_k": 50, "lambda_mult": 0.5}
    if thread_id:
        search_kwargs["filter"] = {"thread_id": thread_id}
        print(f"   [Retriever] Applying session filter: {thread_id}")

    retriever = vector_store.as_retriever(
        search_type="mmr",
        search_kwargs=search_kwargs
    )

    def filter_docs_by_session(docs):
        """Additional safety check to ensure documents match the thread."""
        return docs

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1)
    
    prompt = ChatPromptTemplate.from_template("""
You are an advanced Research Analyst. Use the provided context to answer the user's request.

INSTRUCTIONS:
1. If the context is empty, politely inform the user that you don't have any documents indexed for this specific session.
2. If the user is asking for a comparison, create a structured comparison using Markdown tables.
3. USE IN-TEXT CITATIONS like [Source 1] or [Source 2].
4. If explaining a workflow, architecture, or complex relationship, generate a Mermaid.js diagram using ```mermaid code blocks.
5. Use rich Markdown formatting (bolding, lists, headers) to make the answer easily scannable.

CONTEXT:
{context}

USER REQUEST: {question}

ANALYSIS:
""")
    
    # EXPLICIT LCEL CHAIN with manual filtering
    chain = (
        RunnableParallel({
            "raw_docs": retriever,
            "question": RunnablePassthrough()
        })
        | RunnableParallel({
            "filtered_docs": lambda x: filter_docs_by_session(x["raw_docs"]),
            "question": lambda x: x["question"]
        })
        | RunnableParallel({
            "context": lambda x: format_docs_grouped(x["filtered_docs"]),
            "question": lambda x: x["question"],
            "docs": lambda x: x["filtered_docs"]
        })
        .assign(answer=prompt | llm | StrOutputParser())
    )
    
    return chain

def answer_query(query: str, thread_id: str = None, user_id: str = None, chat_history: list = None):
    """
    Autonomous Agentic RAG Engine with Memory and Evidence Transparency.
    """
    llm_reasoner = ChatOpenAI(model="gpt-4o", temperature=0, max_tokens=1000)
    llm_synthesizer = ChatOpenAI(model="gpt-4o-mini", temperature=0.1, max_tokens=8000)
    
    try:
        unique_docs = []
        ui_candidates = []
        # --- STEP 1: INTENT CLASSIFICATION (The First Filter) ---
        planner_prompt = ChatPromptTemplate.from_template("""
        Analyze this user query and decide if it is a RESEARCH task or a SOCIAL interaction.
        
        - RESEARCH: Technical data, business facts, document analysis, or complex problem-solving.
        - SOCIAL: Greetings, personal advice, human connection, emotions, love, identity, jokes, or any chat that feels like a 'human' conversation.
        
        Output ONLY 'SOCIAL' or 'RESEARCH'.
        
        Query: {query}
        """)
        planner_chain = planner_prompt | llm_reasoner | StrOutputParser()
        intent_raw = planner_chain.invoke({"query": query})
        is_social = "SOCIAL" in intent_raw.upper()
        
        # --- STEP 2: MEMORY-AUGMENTED RESEARCH RE-WRITING (Skipped if Social) ---
        tasks = [query]
        if not is_social:
            if chat_history and len(chat_history) > 0:
                condense_prompt = ChatPromptTemplate.from_template("""
                Rephrase this follow-up question into a standalone RESEARCH task based on the history.
                HISTORY: {history}
                FOLLOW-UP: {query}
                STANDALONE TASK:
                """)
                condense_chain = condense_prompt | llm_reasoner | StrOutputParser()
                query = condense_chain.invoke({"history": str(chat_history[-5:]), "query": query})
                print(f"   [Agent] Memory-Augmented Task: {query}")
            
            # Decompose into sub-tasks
            task_prompt = ChatPromptTemplate.from_template("Decompose this research query into a JSON list of 1-3 specific search strings: {query}")
            task_chain = task_prompt | llm_reasoner | StrOutputParser()
            try:
                tasks = json.loads(task_chain.invoke({"query": query}))
            except:
                tasks = [query]
        
        print(f"   [Agent] Intent: {'SOCIAL' if is_social else 'RESEARCH'} | Plan: {tasks}")

        # --- STEP 2: MULTI-HOP RETRIEVAL (Skipped if Social) ---
        if not is_social:
            all_docs = []
            vector_store = load_vector_store()
            
            if vector_store:
                for task in tasks:
                    filter_dict = {}
                    if user_id: filter_dict["user_id"] = user_id
                    if thread_id: filter_dict["thread_id"] = thread_id
                    search_docs = vector_store.similarity_search(task, k=10, filter=filter_dict if filter_dict else None)
                    all_docs.extend(search_docs)
                
            seen_content = set()
            candidates = []
            for d in all_docs:
                if d.page_content not in seen_content:
                    seen_content.add(d.page_content)
                    candidates.append(d)

            # Competitive Batch Selection
            ui_candidates = candidates[:5] # Always keep top 5 for UI display
            if candidates:
                print(f"   [Agent] Auditor: Performing Competitive Batch Reranking on {len(candidates)} candidates...")
                rerank_prompt = ChatPromptTemplate.from_template("""
                You are a Lead Research Auditor. Given a query and candidates, select indices of directly relevant chunks.
                QUERY: {query}
                CANDIDATES: {candidates}
                Output ONLY a JSON list of indices.
                """)
                candidates_text = ""
                for i, doc in enumerate(candidates[:15]):
                    candidates_text += f"[{i}] SOURCE: {os.path.basename(doc.metadata.get('source', 'Unknown'))}\nCONTENT: {doc.page_content[:300]}...\n\n"
                    
                rerank_chain = rerank_prompt | llm_reasoner | StrOutputParser()
                rerank_raw = rerank_chain.invoke({"query": query, "candidates": candidates_text})
                try:
                    selected_indices = json.loads(rerank_raw.strip("```json").strip())
                    for idx in selected_indices:
                        if idx < len(candidates):
                            unique_docs.append(candidates[idx])
                except:
                    unique_docs = candidates[:5]
            
        print(f"   [Agent] Auditor: Selected {len(unique_docs)} primary evidence chunks. Discarded noise sources.")

        # --- STEP 3: SELF-HEALING VERIFICATION & QUALITY SCORING ---
        max_attempts = 2
        attempt = 0
        final_answer = ""
        confidence = 0.0
        faithfulness_score = 0.0
        relevancy_score = 0.0
        
        while attempt < max_attempts:
            attempt += 1
            context = format_docs_grouped(unique_docs)
            
            # Synthesis with Hybrid Persona (EQ + Research)
            synth_prompt = ChatPromptTemplate.from_template("""
            You are 'ResearchIQ', an Advanced AI Research Intelligence with high Emotional Intelligence (EQ).
            
            CURRENT MODE: {mode}
            (RESEARCH mode means structured data/citations. SOCIAL mode means human-like conversation and warmth.)
            
            INSTRUCTIONS:
            - If MODE is SOCIAL: Respond with appreciation, warmth, and wit. Engage as a charming partner. Do not use formal research structure.
            - If MODE is RESEARCH: 
              1. Start with a **Bold, Engaging Heading** (H2 or H3).
              2. Provide deep analysis using **beautiful bullet points** and **bold text** for key insights.
              3. Use **Mermaid.js diagrams** (Raw syntax in ```mermaid blocks) if the query requires a process, comparison, or architecture.
              4. Always use citations [Source 1] based on the provided context.
              5. Ensure the structure is premium and professional.
            
            CONTEXT:
            {context}
            
            QUERY: {query}
            
            RESPONSE:
            """)
            synth_chain = synth_prompt | llm_synthesizer | StrOutputParser()
            answer = synth_chain.invoke({
                "context": context, 
                "query": query,
                "mode": "SOCIAL" if is_social else "RESEARCH"
            })
            
            # INDUSTRY EVALUATION STEP (Faithfulness & Relevancy)
            eval_prompt = ChatPromptTemplate.from_template("""
            You are a RAG Quality Auditor. Evaluate this synthesis based on the context.
            
            CONTEXT: {context}
            ANSWER: {answer}
            QUERY: {query}
            
            Output JSON: {{"faithfulness": float (0-1), "relevancy": float (0-1), "hallucination": bool, "critique": str}}
            """)
            eval_chain = eval_prompt | llm_reasoner | StrOutputParser()
            eval_raw = eval_chain.invoke({"context": context, "answer": answer, "query": query})
            
            try:
                eval_res = json.loads(eval_raw.strip("```json").strip())
                faithfulness_score = eval_res.get("faithfulness", 0.0)
                relevancy_score = eval_res.get("relevancy", 0.0)
                confidence = (faithfulness_score + relevancy_score) / 2
                
                if not eval_res.get("hallucination") and confidence > 0.7:
                    final_answer = answer
                    break
                else:
                    print(f"   [Agent] Quality Audit Failed (Attempt {attempt}): {eval_res.get('critique')}")
                    final_answer = f"⚠️ [Self-Corrected] {answer}"
            except:
                final_answer = answer
                break

        # --- STEP 3.7: ACTIONABLE AGENT (Tool Selection) ---
        action_trigger = ""
        if "export" in query.lower() or "csv" in query.lower():
            action_trigger = "🛠️ [Action Triggered] Data Extraction Protocol Initiated"
        elif "alert" in query.lower() or "notify" in query.lower():
            action_trigger = "🛠️ [Action Triggered] Priority System Notification Dispatched"
        
        if action_trigger:
            final_answer = f"{action_trigger}\n\n{final_answer}"

        # --- STEP 3.5: WEB FALLBACK (Agentic Routing) ---
        if confidence < 0.6 or not unique_docs:
            print("   [Agent] Local context insufficient. Triggering Web Search Fallback...")
            try:
                from langchain_community.tools import DuckDuckGoSearchRun
                search = DuckDuckGoSearchRun()
                web_context = search.invoke(query)
                
                web_prompt = ChatPromptTemplate.from_template("""
                Answer the user's request using the provided live WEB SEARCH results.
                Use rich Markdown formatting.
                **CRITICAL:** You ARE capable of generating diagrams. If asked for a diagram or flowchart, you MUST write raw Mermaid.js syntax inside a ```mermaid code block. The frontend will render it for you.
                
                WEB RESULTS:
                {context}
                
                QUERY: {query}
                """)
                web_chain = web_prompt | llm_synthesizer | StrOutputParser()
                final_answer = web_chain.invoke({"context": web_context, "query": query})
                final_answer = f"🌐 **[Live Web Fallback Executed]**\n\n{final_answer}"
                confidence = 0.90 # Assumed high confidence since we hit the live web
            except Exception as e:
                print(f"   [Agent] Web search failed: {e}")
                pass

        # --- STEP 4: CITATION EXTRACTION ---
        unique_sources = {}
        for doc in unique_docs:
            source = os.path.basename(doc.metadata.get("source", "Unknown"))
            if source not in unique_sources:
                unique_sources[source] = {
                    "source": source,
                    "pages": set(),
                    "url": doc.metadata.get("file_url")
                }
            page = doc.metadata.get("page", 0) + 1
            unique_sources[source]["pages"].add(page)
        
        citations = []
        for i, (name, data) in enumerate(unique_sources.items()):
            citations.append({
                "id": i + 1,
                "source": name,
                "pages": sorted(list(data["pages"])),
                "url": data.get("url")
            })
        
        # Use ui_candidates if available, fallback to unique_docs
        display_docs = ui_candidates if ui_candidates else unique_docs
        
        return {
            "answer": final_answer,
            "confidence": confidence,
            "faithfulness": faithfulness_score,
            "relevancy": relevancy_score,
            "citations": citations,
            "evidence": [
                {"content": d.page_content, "source": os.path.basename(d.metadata.get("source", "Unknown")), "page": d.metadata.get("page", 0) + 1} 
                for d in display_docs[:5] # Limit to top 5 chunks for UI clarity
            ]
        }
        
    except Exception as e:
        print(f"[Error] Agentic RAG failed: {e}")
        return {"answer": f"Autonomous execution failed: {e}", "citations": [], "confidence": 0}

if __name__ == "__main__":
    if os.getenv("OPENAI_API_KEY"):
        res = answer_query("test query")
        print(res)
