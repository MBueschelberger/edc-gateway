"""Async HTTP client for the EDC Management API (catalog, negotiations, EDRs, transfers)."""

import json
import logging
from urllib.parse import urljoin

import httpx

from app.db.models import EDCConfig
from app.services.http_utils import _resp_body
from app.services.k8s_client import edc_secret_name, read_secret

logger = logging.getLogger(__name__)


def _ensure_dsp_suffix(url: str, suffix: str) -> str:
    return url if url.endswith(suffix) else url + suffix


def _headers(api_key: str) -> dict[str, str]:
    return {"x-api-key": api_key, "accept": "application/json", "Content-Type": "application/json"}


def _cert(secret: dict) -> dict:
    path = secret.get("client_cert_path", "")
    password = secret.get("client_cert_password", "")
    if path:
        return {"cert": (path, password) if password else path}
    return {}


async def _get(edc: EDCConfig, path: str, *, consumer: bool = True) -> httpx.Response:
    secret = read_secret(edc_secret_name(edc.id))
    api_key = secret["consumer_api_key" if consumer else "provider_api_key"]
    base = edc.consumer_url if consumer else edc.provider_dsp_url
    async with httpx.AsyncClient(**_cert(secret), timeout=edc.http_timeout) as client:
        resp = await client.get(urljoin(base, path), headers=_headers(api_key))
    if resp.is_error:
        logger.error("GET %s%s → %s\nresponse:\n%s", base, path, resp.status_code, _resp_body(resp))
    return resp


async def _post(
    edc: EDCConfig, path: str, payload: dict, *, consumer: bool = True
) -> httpx.Response:
    secret = read_secret(edc_secret_name(edc.id))
    api_key = secret["consumer_api_key" if consumer else "provider_api_key"]
    base = edc.consumer_url if consumer else edc.provider_dsp_url
    async with httpx.AsyncClient(**_cert(secret), timeout=edc.http_timeout) as client:
        resp = await client.post(urljoin(base, path), json=payload, headers=_headers(api_key))
    if resp.is_error:
        logger.error(
            "POST %s%s → %s\npayload:\n%s\nresponse:\n%s",
            base,
            path,
            resp.status_code,
            json.dumps(payload, indent=2),
            _resp_body(resp),
        )
    return resp


async def fetch_catalog(
    edc: EDCConfig,
    provider_did: str,
    provider_dsp_url: str,
    asset_id: str | None = None,
) -> httpx.Response:
    """Request the DSP catalog from a provider EDC."""
    suffix = "/2025-1" if edc.use_2025_1 else ""
    protocol = "dataspace-protocol-http:2025-1" if edc.use_2025_1 else "dataspace-protocol-http"
    filter_expr = (
        [{"operandLeft": "id", "operator": "=", "operandRight": asset_id}] if asset_id else []
    )
    payload = {
        "@context": [{"@vocab": "https://w3id.org/edc/v0.0.1/ns/"}],
        "@type": "CatalogRequest",
        "counterPartyId": provider_did,
        "counterPartyAddress": f"{provider_dsp_url}{suffix}",
        "protocol": protocol,
        "querySpec": {"offset": 0, "limit": 50, "filterExpression": filter_expr},
    }
    return await _post(edc, "/management/v3/catalog/request", payload)


async def get_negotiation(edc: EDCConfig, negotiation_id: str) -> httpx.Response:
    """Get the status of a single contract negotiation."""
    return await _get(edc, f"/management/v3/contractnegotiations/{negotiation_id}")


async def list_negotiations(edc: EDCConfig, limit: int = 100, offset: int = 0) -> httpx.Response:
    """List contract negotiations with pagination."""
    payload = {
        "@context": ["https://w3id.org/edc/connector/management/v0.0.1"],
        "@type": "QuerySpec",
        "limit": limit,
        "offset": offset,
        "filterExpression": [],
    }
    return await _post(edc, "/management/v3/contractnegotiations/request", payload)


async def list_edrs(edc: EDCConfig, agreement_id: str | None = None) -> httpx.Response:
    """List EDR entries, optionally filtered by agreement ID."""
    filter_expr = (
        [{"operandLeft": "agreementId", "operator": "=", "operandRight": agreement_id}]
        if agreement_id
        else []
    )
    payload = {
        "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
        "@type": "QuerySpec",
        "filterExpression": filter_expr,
    }
    return await _post(edc, "/management/v3/edrs/request", payload)


async def get_edr_dataaddress(edc: EDCConfig, edr_id: str) -> httpx.Response:
    """Retrieve the data address for a specific EDR transfer process."""
    return await _get(edc, f"/management/v3/edrs/{edr_id}/dataaddress")


async def list_transfers(edc: EDCConfig, limit: int = 100, offset: int = 0) -> httpx.Response:
    """List transfer processes with pagination."""
    payload = {
        "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
        "@type": "QuerySpec",
        "limit": limit,
        "offset": offset,
        "filterExpression": [],
    }
    return await _post(edc, "/management/v3/transferprocesses/request", payload)


async def get_transfer_state(edc: EDCConfig, transfer_id: str) -> httpx.Response:
    """Get the current state of a transfer process."""
    return await _get(edc, f"/management/v3/transferprocesses/{transfer_id}/state")


async def list_provider_assets(edc: EDCConfig, limit: int = 1000) -> httpx.Response:
    """List all assets registered on the provider EDC."""
    payload = {
        "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
        "@type": "QuerySpec",
        "limit": limit,
        "offset": 0,
        "filterExpression": [],
    }
    return await _post(edc, "/management/v3/assets/request", payload, consumer=False)
