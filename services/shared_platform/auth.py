from datetime import UTC, datetime, timedelta
from hashlib import scrypt
from os import urandom
import jwt
from .settings import setting


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or urandom(16)
    digest = scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    salt_hex, _ = encoded.split(":", 1)
    return hash_password(password, bytes.fromhex(salt_hex)) == encoded


def issue_token(user_id: str, role: str = "CUSTOMER") -> str:
    return jwt.encode({"sub": user_id, "role": role, "exp": datetime.now(UTC)+timedelta(minutes=int(setting("JWT_EXPIRE_MINUTES", "480")))}, setting("JWT_SECRET", "change-this-local-development-secret"), algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, setting("JWT_SECRET", "change-this-local-development-secret"), algorithms=["HS256"])
