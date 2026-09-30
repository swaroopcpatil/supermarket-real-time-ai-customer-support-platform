import importlib
import pytest

provider_module = importlib.import_module("services.ai-orchestrator.nim.provider")
MockLLMProvider = provider_module.MockLLMProvider


@pytest.mark.asyncio
async def test_order_lookup_does_not_disclose_another_customer_order():
    response = await MockLLMProvider().process_user_message(
        "Where is my order ORD-1001?", customer_id="CUS-OTHER"
    )
    assert "OUT_FOR_DELIVERY" not in response["message"]
    assert "couldn't find" in response["message"]


@pytest.mark.asyncio
async def test_refund_is_not_created_for_another_customer_order():
    response = await MockLLMProvider().process_user_message(
        "My item was damaged in ORD-1001", customer_id="CUS-OTHER"
    )
    assert "have not created" in response["message"]
