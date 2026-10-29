"""Shared helpers used by multiple router modules."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import BPNRegistryEntry, EDCConfig


async def get_edc(edc_id: str, session: AsyncSession) -> EDCConfig:
    """Load an EDCConfig by ID or raise 404."""
    edc = await session.get(EDCConfig, edc_id)
    if not edc:
        raise HTTPException(404, "EDC not found")
    return edc


async def get_bpn_registry_entry(
    edc_id: str, bpn: str, session: AsyncSession
) -> BPNRegistryEntry | None:
    """Look up a BPN registry entry for the given EDC and BPN, or return None."""
    result = await session.execute(
        select(BPNRegistryEntry).where(
            BPNRegistryEntry.edc_id == edc_id,
            BPNRegistryEntry.bpn == bpn,
        )
    )
    return result.scalar_one_or_none()
