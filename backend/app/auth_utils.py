import os
import base64
import hashlib
import datetime
import logging
from typing import Optional, Dict, Any
import jwt
import bcrypt
from cryptography.fernet import Fernet
from fastapi import Request, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db, AsyncSessionLocal

logger = logging.getLogger("zengram.auth")

SECRET_FILE_PATH = os.path.expanduser("~/.config/zengram/jwt_secret.key")
OLD_SECRET_FILE_PATH = os.path.expanduser("~/.config/instasave/jwt_secret.key")


def _get_or_create_jwt_secret() -> str:
    """Retrieve or generate a persistent cryptographic JWT secret key."""
    env_secret = os.environ.get("ZENGRAM_JWT_SECRET") or os.environ.get("INSTASAVE_JWT_SECRET")
    if env_secret:
        return env_secret

    try:
        if os.path.exists(SECRET_FILE_PATH):
            try:
                os.chmod(SECRET_FILE_PATH, 0o600)
            except Exception:
                pass
            with open(SECRET_FILE_PATH, "r", encoding="utf-8") as f:
                secret = f.read().strip()
                if secret:
                    return secret
        elif os.path.exists(OLD_SECRET_FILE_PATH):
            try:
                os.chmod(OLD_SECRET_FILE_PATH, 0o600)
            except Exception:
                pass
            with open(OLD_SECRET_FILE_PATH, "r", encoding="utf-8") as f:
                secret = f.read().strip()
                if secret:
                    return secret

        secret_dir = os.path.dirname(SECRET_FILE_PATH)
        os.makedirs(secret_dir, mode=0o700, exist_ok=True)
        try:
            os.chmod(secret_dir, 0o700)
        except Exception:
            pass

        new_secret = os.urandom(32).hex()
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        fd = os.open(SECRET_FILE_PATH, flags, 0o600)
        with open(fd, "w", encoding="utf-8") as f:
            f.write(new_secret)
        return new_secret
    except Exception as e:
        logger.critical(f"FATAL: Unable to load or generate persistent JWT secret key: {e}")
        raise RuntimeError(
            f"Security initialization failure: Unable to read or persist JWT secret key at {SECRET_FILE_PATH}. "
            "ZenGram cannot start with an insecure or unpersisted key. Please check directory permissions or set ZENGRAM_JWT_SECRET."
        ) from e


JWT_SECRET = _get_or_create_jwt_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30


def _get_encryption_cipher() -> Fernet:
    """Derive a 32-byte urlsafe base64 Fernet key from the local persistent JWT_SECRET."""
    key_bytes = hashlib.sha256(JWT_SECRET.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_secret(plaintext: Optional[str]) -> str:
    """Encrypt sensitive token string for safe storage at rest (AES-256 Fernet)."""
    if not plaintext or plaintext == "dummy_session_cookie":
        return plaintext or "dummy_session_cookie"
    if plaintext.startswith("enc:"):
        return plaintext
    try:
        cipher = _get_encryption_cipher()
        encrypted = cipher.encrypt(plaintext.encode("utf-8")).decode("utf-8")
        return f"enc:{encrypted}"
    except Exception as e:
        logger.error(f"Error encrypting secret at rest: {e}")
        return plaintext


def decrypt_secret(ciphertext: Optional[str]) -> str:
    """Decrypt sensitive token string from storage at rest (AES-256 Fernet)."""
    if not ciphertext or ciphertext == "dummy_session_cookie":
        return ciphertext or ""
    if not ciphertext.startswith("enc:"):
        return ciphertext  # Graceful fallback for unencrypted legacy databases
    try:
        raw_b64 = ciphertext[4:]
        cipher = _get_encryption_cipher()
        decrypted = cipher.decrypt(raw_b64.encode("utf-8")).decode("utf-8")
        return decrypted
    except Exception as e:
        logger.error(f"Error decrypting secret at rest: {e}")
        return ""


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Generate a signed JWT token with an expiration timestamp."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "iat": datetime.datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a signed JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


async def get_current_admin(request: Request, db: AsyncSession = Depends(get_db)):
    """
    FastAPI dependency for general app endpoints:
    - Reads the secure HttpOnly cookie `zengram_token` / `instasave_token` (or `Authorization: Bearer <token>` header).
    - If no admin is configured, raises HTTP 401 Unauthorized (system setup required).
    - If authentication requirement has been explicitly disabled by the user, allows access.
    - If enabled and unauthenticated, raises HTTP 401 Unauthorized.
    """
    from backend.app.models import AdminUser
    result = await db.execute(select(AdminUser))
    admin = result.scalars().first()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="System setup required. Please configure master administrator password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not admin.auth_enabled:
        return admin

    token = request.cookies.get("zengram_token") or request.cookies.get("instasave_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    if admin.username.lower() != username.lower():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not recognized.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return admin


async def require_admin_auth(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Strict FastAPI dependency for credential management & security changes:
    - ALWAYS requires valid JWT authentication, regardless of whether general auth_enabled is toggled off.
    - Protects master password, Instagram session tokens, and security settings.
    """
    from backend.app.models import AdminUser
    result = await db.execute(select(AdminUser))
    admin = result.scalars().first()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="System setup required. Please configure master administrator password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = request.cookies.get("zengram_token") or request.cookies.get("instasave_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Master authentication required for credential and security management.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    if admin.username.lower() != username.lower():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not recognized.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return admin
