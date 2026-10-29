"""JWT verification against a Keycloak JWKS endpoint with automatic key-rotation retry."""

import asyncio

import httpx
import jwt
from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError, PyJWKSetError

from app.config.settings import settings

security = HTTPBearer()

_jwks: dict = {"data": None}
_jwks_lock = asyncio.Lock()


async def _get_jwks() -> dict:
    async with _jwks_lock:
        if _jwks["data"] is None:
            async with httpx.AsyncClient() as client:
                resp = await client.get(settings.oidc_jwks_url, timeout=settings.oidc_timeout)
                resp.raise_for_status()
                _jwks["data"] = resp.json()
    return _jwks["data"]


def invalidate_jwks_cache() -> None:
    """Clear the cached JWKS so the next verification re-fetches from the IdP."""
    _jwks["data"] = None


def _decode(token: str, jwks_data: dict) -> dict:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")

    jwks = jwt.PyJWKSet.from_dict(jwks_data)
    signing_key = next(
        (k for k in jwks.keys if not kid or k.key_id == kid),
        None,
    )
    if signing_key is None:
        raise PyJWKSetError(f"No signing key found for kid={kid!r}")

    options = {"verify_aud": bool(settings.oidc_audience)}
    decode_kwargs: dict = {
        "algorithms": ["RS256"],
        "issuer": settings.oidc_issuer,
        "options": options,
    }
    if settings.oidc_audience:
        decode_kwargs["audience"] = settings.oidc_audience

    return jwt.decode(token, signing_key.key, **decode_kwargs)


async def verify_token(credentials: HTTPAuthorizationCredentials) -> dict:
    """Decode and verify a Bearer JWT, retrying once on key-rotation."""
    try:
        return _decode(credentials.credentials, await _get_jwks())
    except (InvalidTokenError, PyJWKSetError):
        # Retry once with a fresh JWKS in case keys were rotated
        invalidate_jwks_cache()
        try:
            return _decode(credentials.credentials, await _get_jwks())
        except (InvalidTokenError, PyJWKSetError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
            ) from exc
