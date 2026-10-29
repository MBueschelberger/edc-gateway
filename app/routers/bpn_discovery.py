"""Route for BPN discovery lookups against an EDC's discovery service."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import BPNRegistryEntry, User
from app.db.session import get_session
from app.models.edc import BPNDiscoveryEntry
from app.routers.utils import get_edc
from app.services import bpn_discovery_client

router = APIRouter(prefix="/edcs/{edc_id}/bpn-discovery", tags=["bpn-discovery"])


@router.post("", response_model=list[BPNDiscoveryEntry])
async def fetch_bpn_discovery(
    edc_id: str,
    limit: int = 20,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.BPN_DISCOVERY)),
) -> list[BPNDiscoveryEntry]:
    """Return locally managed BPN registry entries if present.

    Otherwise proxy to the external BPN Discovery service.
    """
    result = await session.execute(
        select(BPNRegistryEntry)
        .where(BPNRegistryEntry.edc_id == edc_id)
        .options(selectinload(BPNRegistryEntry.endpoints))
    )
    local_entries = result.scalars().all()
    if local_entries:
        return [
            BPNDiscoveryEntry(bpn=e.bpn, connectorEndpoint=e.connector_endpoints)
            for e in local_entries
        ]

    edc = await get_edc(edc_id, session)
    if (
        not edc.bpn_discovery_auth_url
        or not edc.bpn_discovery_host
        or not edc.bpn_discovery_endpoint
    ):
        raise HTTPException(422, "BPN Discovery is not configured for this EDC")
    return await bpn_discovery_client.fetch_bpn_discovery(edc=edc, limit=limit, offset=offset)
