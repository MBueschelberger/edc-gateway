"""Route for deleting EDC provider assets via Argo Workflows."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import Job, User
from app.db.session import get_session
from app.models.job import DeleteAssetRequest, JobResponse
from app.routers.utils import get_edc
from app.services import argo_client

router = APIRouter(prefix="/edcs/{edc_id}/assets/delete", tags=["assets"])


@router.post("", response_model=JobResponse, status_code=202)
async def delete_asset(
    edc_id: str,
    body: DeleteAssetRequest,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.CREATE_ASSET)),
) -> JobResponse:
    """Submit a delete-asset Argo workflow.

    Returns 202 immediately with a job ID; track progress via GET /jobs/{id}/stream.
    """
    edc = await get_edc(edc_id, session)

    job = Job(
        edc_id=edc_id,
        operation="delete_asset",
    )
    session.add(job)
    await session.flush()

    params = {
        "edc_id": edc_id,
        "asset_id": body.asset_id,
        "provider_url": edc.provider_url,
        "debug": str(body.debug).lower(),
    }

    workflow_name = await argo_client.submit_workflow(
        template_name=edc.argo_delete_asset_template,
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
