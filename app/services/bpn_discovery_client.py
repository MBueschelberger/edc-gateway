"""Client for querying the BPN Discovery Service via OAuth2-authenticated HTTP."""

import json
import logging
from typing import Any

import httpx

from app.db.models import EDCConfig
from app.services.http_utils import _resp_body
from app.services.k8s_client import edc_secret_name, read_secret

logger = logging.getLogger(__name__)


async def _fetch_token(auth_url: str, client_id: str, client_secret: str, timeout: float) -> str:
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            auth_url,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            logger.error(
                "POST %s (token fetch) failed with %s\nresponse:\n%s",
                auth_url,
                resp.status_code,
                _resp_body(resp),
            )
            raise
        return resp.json()["access_token"]


async def fetch_bpn_discovery(
    edc: EDCConfig,
    limit: int = 20,
    offset: int = 0,
) -> Any:
    """Fetch BPN discovery entries for the given EDC, with pagination."""
    secret = read_secret(edc_secret_name(edc.id))
    client_id = secret.get("bpn_discovery_client_id", "")
    client_secret = secret.get("bpn_discovery_client_secret", "")

    token = await _fetch_token(
        edc.bpn_discovery_auth_url, client_id, client_secret, edc.http_timeout
    )

    url = f"{edc.bpn_discovery_host}{edc.bpn_discovery_endpoint}"
    payload: list = []
    async with httpx.AsyncClient(timeout=edc.http_timeout) as client:
        resp = await client.post(
            url,
            params={"size": limit, "page": offset},
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "accept": "application/json",
                "Content-Type": "application/json",
            },
        )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            logger.error(
                "POST %s failed with %s\npayload:\n%s\nresponse:\n%s",
                url,
                resp.status_code,
                json.dumps(payload, indent=2),
                _resp_body(resp),
            )
            raise
        return resp.json()
