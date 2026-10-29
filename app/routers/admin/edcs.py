"""Admin routes for EDC configuration CRUD and K8s secret management."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.permissions import EDCOperation, PermissionScope
from app.auth.rbac import require_permission
from app.db.models import BPNRegistryEndpoint, BPNRegistryEntry, EDCConfig, User
from app.db.session import get_session
from app.models.edc import (
    BPNRegistryEntryCreate,
    BPNRegistryEntryResponse,
    BPNRegistryEntryUpdate,
    EDCCreateRequest,
    EDCResponse,
    EDCUpdateRequest,
)
from app.services.k8s_client import create_or_update_secret, delete_secret, edc_secret_name

router = APIRouter(prefix="/admin/edcs", tags=["admin"])


def _secret_data(secrets) -> dict[str, str]:
    return {k: v for k, v in secrets.model_dump().items() if v}


@router.post("", response_model=EDCResponse, status_code=201)
async def register_edc(
    body: EDCCreateRequest,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> EDCConfig:
    """Register a new EDC.

    Atomically writes credentials to the Kubernetes secret and saves config to PostgreSQL.
    """
    if await session.get(EDCConfig, body.id):
        raise HTTPException(409, f"EDC '{body.id}' already exists")

    create_or_update_secret(edc_secret_name(body.id), _secret_data(body.secrets))

    edc = EDCConfig(
        id=body.id,
        display_name=body.display_name,
        consumer_url=body.consumer_url,
        provider_url=body.provider_url,
        base_did=body.base_did,
        provider_bpn=body.provider_bpn,
        submodel_server_url=body.submodel_server_url,
        bpn_discovery_auth_url=body.bpn_discovery_auth_url,
        bpn_discovery_host=body.bpn_discovery_host,
        bpn_discovery_endpoint=body.bpn_discovery_endpoint,
        http_timeout=body.http_timeout,
        sse_poll_interval=body.sse_poll_interval,
        use_2025_1=body.use_2025_1,
        use_edrs=body.use_edrs,
        use_bpn=body.use_bpn,
        contract_negotiation_router=body.contract_negotiation_router,
        provider_dsp_suffix=body.provider_dsp_suffix,
        argo_consume_template=body.argo_consume_template,
        argo_create_asset_template=body.argo_create_asset_template,
        argo_delete_asset_template=body.argo_delete_asset_template,
        dcat_catalog_url=body.dcat_catalog_url,
        dcat_sparql_query=body.dcat_sparql_query,
        job_output_parameter_whitelist=body.job_output_parameter_whitelist,
        job_artifact_whitelist=body.job_artifact_whitelist,
        job_asset_artifact_name=body.job_asset_artifact_name,
        job_asset_filename_parameter=body.job_asset_filename_parameter,
        job_asset_content_type_parameter=body.job_asset_content_type_parameter,
        k8s_secret_name=edc_secret_name(body.id),
    )
    session.add(edc)
    await session.commit()
    await session.refresh(edc)
    return edc


@router.get("", response_model=list[EDCResponse])
async def list_edcs(
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> list[EDCConfig]:
    """List all registered EDCs. Requires global EDC manage permission."""
    result = await session.execute(select(EDCConfig))
    return list(result.scalars().all())


@router.get("/{edc_id}", response_model=EDCResponse)
async def get_edc(
    edc_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> EDCConfig:
    """Return a single EDC configuration by ID."""
    edc = await session.get(EDCConfig, edc_id)
    if not edc:
        raise HTTPException(404, "EDC not found")
    return edc


@router.patch("/{edc_id}", response_model=EDCResponse)
async def update_edc(
    edc_id: str,
    body: EDCUpdateRequest,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> EDCConfig:
    """Partially update an EDC's configuration and/or credentials.

    If secrets are provided, overwrites the Kubernetes secret.
    """
    edc = await session.get(EDCConfig, edc_id)
    if not edc:
        raise HTTPException(404, "EDC not found")

    if body.secrets is not None:
        create_or_update_secret(edc_secret_name(edc_id), _secret_data(body.secrets))

    for field in [
        "display_name",
        "consumer_url",
        "provider_url",
        "base_did",
        "provider_bpn",
        "submodel_server_url",
        "bpn_discovery_auth_url",
        "bpn_discovery_host",
        "bpn_discovery_endpoint",
        "http_timeout",
        "sse_poll_interval",
        "use_2025_1",
        "use_edrs",
        "use_bpn",
        "contract_negotiation_router",
        "provider_dsp_suffix",
        "argo_consume_template",
        "argo_create_asset_template",
        "argo_delete_asset_template",
        "dcat_catalog_url",
        "dcat_sparql_query",
        "job_output_parameter_whitelist",
        "job_artifact_whitelist",
        "job_asset_artifact_name",
        "job_asset_filename_parameter",
        "job_asset_content_type_parameter",
    ]:
        value = getattr(body, field)
        if value is not None:
            setattr(edc, field, value)

    await session.commit()
    await session.refresh(edc)
    return edc


@router.delete("/{edc_id}", status_code=204)
async def delete_edc(
    edc_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> None:
    """Delete an EDC and its associated Kubernetes secret."""
    edc = await session.get(EDCConfig, edc_id)
    if not edc:
        raise HTTPException(404, "EDC not found")
    delete_secret(edc_secret_name(edc_id))
    await session.delete(edc)
    await session.commit()


# ── BPN registry sub-routes ──────────────────────────────────────────────────


async def _get_entry(edc_id: str, entry_id: UUID, session: AsyncSession) -> BPNRegistryEntry:
    result = await session.execute(
        select(BPNRegistryEntry)
        .where(BPNRegistryEntry.id == entry_id, BPNRegistryEntry.edc_id == edc_id)
        .options(selectinload(BPNRegistryEntry.endpoints))
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "BPN registry entry not found")
    return entry


@router.get("/{edc_id}/bpn-registry", response_model=list[BPNRegistryEntryResponse])
async def list_bpn_registry_entries(
    edc_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> list[BPNRegistryEntry]:
    """List all locally managed BPN registry entries for an EDC."""
    if not await session.get(EDCConfig, edc_id):
        raise HTTPException(404, "EDC not found")
    result = await session.execute(
        select(BPNRegistryEntry)
        .where(BPNRegistryEntry.edc_id == edc_id)
        .options(selectinload(BPNRegistryEntry.endpoints))
    )
    return list(result.scalars().all())


@router.post("/{edc_id}/bpn-registry", response_model=BPNRegistryEntryResponse, status_code=201)
async def create_bpn_registry_entry(
    edc_id: str,
    body: BPNRegistryEntryCreate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> BPNRegistryEntry:
    """Add a BPN with its connector endpoints to the local registry of an EDC."""
    if not await session.get(EDCConfig, edc_id):
        raise HTTPException(404, "EDC not found")
    existing = await session.execute(
        select(BPNRegistryEntry).where(
            BPNRegistryEntry.edc_id == edc_id, BPNRegistryEntry.bpn == body.bpn
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"BPN '{body.bpn}' already registered for this EDC")
    entry = BPNRegistryEntry(edc_id=edc_id, bpn=body.bpn, did=body.did, dsp_suffix=body.dsp_suffix)
    entry.endpoints = [BPNRegistryEndpoint(url=url) for url in body.connector_endpoints]
    session.add(entry)
    await session.commit()
    return await _get_entry(edc_id, entry.id, session)


@router.patch("/{edc_id}/bpn-registry/{entry_id}", response_model=BPNRegistryEntryResponse)
async def update_bpn_registry_entry(
    edc_id: str,
    entry_id: UUID,
    body: BPNRegistryEntryUpdate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> BPNRegistryEntry:
    """Replace the connector endpoints of a BPN registry entry."""
    entry = await _get_entry(edc_id, entry_id, session)
    for ep in list(entry.endpoints):
        await session.delete(ep)
    entry.endpoints = [BPNRegistryEndpoint(url=url) for url in body.connector_endpoints]
    entry.did = body.did
    entry.dsp_suffix = body.dsp_suffix
    await session.commit()
    return await _get_entry(edc_id, entry_id, session)


@router.delete("/{edc_id}/bpn-registry/{entry_id}", status_code=204)
async def delete_bpn_registry_entry(
    edc_id: str,
    entry_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_permission(PermissionScope.EDC, "*", EDCOperation.MANAGE)),
) -> None:
    """Remove a BPN and all its connector endpoints from the local registry."""
    entry = await _get_entry(edc_id, entry_id, session)
    await session.delete(entry)
    await session.commit()
