import importlib, uvicorn
mod = importlib.import_module("services.rag-service.app.main")
uvicorn.run(mod.app, host="0.0.0.0", port=8006)
