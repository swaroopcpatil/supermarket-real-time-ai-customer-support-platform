import pytest
import importlib

order_module = importlib.import_module("services.order-service.app.main")
fetch_order = order_module.fetch_order
cancel_order_endpoint = order_module.cancel_order_endpoint
create_order = order_module.create_order
OrderCreate = order_module.OrderCreate
OrderItemInput = order_module.OrderItemInput

def test_fetch_order():
    ord_data = fetch_order("ORD-1001")
    assert ord_data["id"] == "ORD-1001"
    assert ord_data["status"] == "OUT_FOR_DELIVERY"

def test_cancel_order():
    new_ord = create_order(OrderCreate(
        customer_id="CUS-DEMO",
        delivery_address="123 Test St",
        items=[OrderItemInput(product_id="PRD-0001", name="Milk", quantity=1, unit_price=68.0)]
    ))
    res = cancel_order_endpoint(new_ord["id"])
    assert res["order"]["status"] == "CANCELLED"
