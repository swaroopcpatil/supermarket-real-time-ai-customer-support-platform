import importlib

rag_module = importlib.import_module("services.rag-service.app.main")
search_knowledge_base = rag_module.search_knowledge_base
SearchRequest = rag_module.SearchRequest

def test_rag_search_refund_policy():
    res = search_knowledge_base(SearchRequest(query="What is your refund policy?"))
    assert res["retrieved_count"] > 0
    top = res["results"][0]
    assert "Refund" in top["title"] or "Policy" in top["title"]
    assert top["similarity_score"] > 0.5

def test_rag_search_delivery_charges():
    res = search_knowledge_base(SearchRequest(query="What are your delivery charges?"))
    assert res["retrieved_count"] > 0
    top = res["results"][0]
    assert "Delivery" in top["title"] or "Rs 499" in top["content"]
