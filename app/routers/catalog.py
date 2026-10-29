"""Routes for fetching EDC and DCAT catalog data."""

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import User
from app.db.session import get_session
from app.routers.utils import get_bpn_registry_entry, get_edc
from app.services import edc_client
from app.services.edc_client import _ensure_dsp_suffix

router = APIRouter(prefix="/edcs/{edc_id}/catalog", tags=["catalog"])


@router.post("")
async def fetch_catalog(
    edc_id: str,
    provider_bpn: str | None = None,
    provider_dsp_url: str | None = None,
    asset_id: str | None = None,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.CATALOG)),
) -> Response:
    """Synchronously fetch the provider's data catalog.

    Query params override provider_bpn/provider_dsp_url and filter by asset_id.
    """
    edc = await get_edc(edc_id, session)
    if provider_bpn:
        reg = await get_bpn_registry_entry(edc_id, provider_bpn, session)
        effective_did_base = (reg.did if reg and reg.did else None) or edc.base_did
        effective_dsp_suffix = (
            reg.dsp_suffix if reg and reg.dsp_suffix else None
        ) or edc.provider_dsp_suffix
        provider_did = f"{effective_did_base}:{provider_bpn}" if effective_did_base else ""
        resolved_dsp_url = _ensure_dsp_suffix(
            provider_dsp_url or edc.provider_dsp_url, effective_dsp_suffix
        )
    else:

        provider_did = edc.provider_did
        resolved_dsp_url = provider_dsp_url or edc.provider_dsp_url
    resp = await edc_client.fetch_catalog(
        edc=edc,
        provider_did=provider_did,
        provider_dsp_url=resolved_dsp_url,
        asset_id=asset_id,
    )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )
