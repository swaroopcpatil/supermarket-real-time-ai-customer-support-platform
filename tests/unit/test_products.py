import importlib

prod_module = importlib.import_module("services.product-service.app.main")
list_products = prod_module.list_products
search_products = prod_module.search_products
get_product = prod_module.get_product
check_availability = prod_module.check_availability

def test_list_products():
    items = list_products(limit=10)
    assert len(items) == 10

def test_search_products():
    res = search_products(q="Amul")
    assert len(res) > 0
    assert "Amul" in res[0]["name"] or "Amul" in res[0]["brand"]

def test_product_availability():
    av = check_availability("PRD-0001")
    assert av["product_id"] == "PRD-0001"
    assert av["is_available"] is True
