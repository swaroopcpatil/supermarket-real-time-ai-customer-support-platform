import pytest
import importlib

provider_module = importlib.import_module("services.ai-orchestrator.nim.provider")
MockLLMProvider = provider_module.MockLLMProvider

@pytest.mark.asyncio
async def test_order_status_routing():
    provider = MockLLMProvider()
    res = await provider.process_user_message("Where is my order ORD-1001?")
    assert res["ai_activity"]["agent"] == "Order Agent"
    assert "get_order_status" in res["ai_activity"]["tools_called"]
    assert "ORD-1001" in res["message"]

@pytest.mark.asyncio
async def test_product_availability_routing():
    provider = MockLLMProvider()
    res = await provider.process_user_message("Is Amul milk available?")
    assert res["ai_activity"]["agent"] == "Product Agent"
    assert "check_product_stock" in res["ai_activity"]["tools_called"]
    assert "Amul" in res["message"] or "Milk" in res["message"]

@pytest.mark.asyncio
async def test_refund_request_routing():
    provider = MockLLMProvider()
    res = await provider.process_user_message("My milk packet was damaged in ORD-1001.")
    assert res["ai_activity"]["agent"] == "Refund Agent"
    assert "create_refund_request" in res["ai_activity"]["tools_called"]
    assert "RFD-" in res["message"]

@pytest.mark.asyncio
async def test_human_escalation_routing():
    provider = MockLLMProvider()
    res = await provider.process_user_message("I want to talk to a human support agent.")
    assert res["ai_activity"]["agent"] == "Escalation Agent"
    assert res["ai_activity"]["escalated"] is True
    assert "TKT-" in res["message"]
