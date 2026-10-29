"""Route for consuming EDC assets via Argo Workflows."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import Job, User
from app.db.session import get_session
from app.models.job import ConsumeAssetRequest, JobResponse
from app.routers.utils import get_bpn_registry_entry, get_edc
from app.services import argo_client
from app.services.edc_client import _ensure_dsp_suffix

router = APIRouter(prefix="/edcs/{edc_id}/consume", tags=["consume"])


@router.post("", response_model=JobResponse, status_code=202)
async def consume_asset(
    edc_id: str,
    body: ConsumeAssetRequest,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.CONSUME)),
) -> JobResponse:
    """Submit a consume-asset Argo workflow.

    Returns 202 immediately with a job ID; track progress via GET /jobs/{id}/stream.
    """
    edc = await get_edc(edc_id, session)

    job = Job(
        edc_id=edc_id,
        operation="consume",
    )
    session.add(job)
    await session.flush()

    effective_bpn = body.provider_bpn or edc.provider_bpn
    reg = await get_bpn_registry_entry(edc_id, effective_bpn, session)
    effective_did_base = (reg.did if reg and reg.did else None) or edc.base_did
    effective_dsp_suffix = (
        reg.dsp_suffix if reg and reg.dsp_suffix else None
    ) or edc.provider_dsp_suffix
    provider_did = f"{effective_did_base}:{effective_bpn}" if effective_did_base else ""

    params = {
        "edc_id": edc_id,
        "asset_id": body.asset_id,
        "consumer_url": edc.consumer_url,
        "provider_did": provider_did,
        "provider_bpn": effective_bpn,
        "provider_dsp_url": _ensure_dsp_suffix(
            body.provider_dsp_url or edc.provider_dsp_url, effective_dsp_suffix
        ),
        "use_2025_1": str(edc.use_2025_1).lower(),
        "use_edrs": str(body.use_edrs if body.use_edrs is not None else edc.use_edrs).lower(),
        "use_bpn": str(edc.use_bpn).lower(),
        "contract_negotiation_router": edc.contract_negotiation_router,
        "add_membership": str(body.add_membership).lower(),
        "debug": str(body.debug).lower(),
    }

    workflow_name = await argo_client.submit_workflow(
        template_name=edc.argo_consume_template,
        parameters=params,
        job_id=str(job.id),
    )

    job.argo_workflow_name = workflow_name
    await session.commit()
    await session.refresh(job)
    return JobResponse(
        id=job.id,
        edc_id=job.edc_id,
        operation=job.operation,
        argo_workflow_name=job.argo_workflow_name,
        created_at=job.created_at,
    )
