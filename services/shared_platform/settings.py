from functools import lru_cache
from os import getenv


@lru_cache
def setting(name: str, default: str) -> str:
    return getenv(name, default)


def service_url(name: str, port: int) -> str:
    return setting(f"{name.upper().replace('-', '_')}_URL", f"http://{name}:{port}")
