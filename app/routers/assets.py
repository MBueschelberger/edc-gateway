"""Route for creating EDC provider assets via Argo Workflows."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import Job, User
from app.db.session import get_session
from app.models.edc import DCATDataset, DCATResource
from app.models.job import CreateAssetRequest, JobResponse
from app.routers.utils import get_edc
from app.services import argo_client, dcat_client

router = APIRouter(prefix="/edcs/{edc_id}/assets", tags=["assets"])


@router.get("/dcat-catalog", response_model=list[DCATDataset])
async def list_dcat_catalog(
    edc_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.CREATE_ASSET)),
) -> list[DCATDataset]:
    """Return datasets from the configured DCAT catalog that are not yet registered in the EDC.
    Returns 422 if dcat_catalog_url or dcat_sparql_query is not configured for this EDC."""
    edc = await get_edc(edc_id, session)

    if not edc.dcat_catalog_url or not edc.dcat_sparql_query:
        raise HTTPException(
            422,
            "DCAT catalog URL and SPARQL query must be configured"
            " for this EDC before using catalog discovery",
        )

    raw_datasets = await dcat_client.fetch_dcat_datasets(edc)

    result: list[DCATDataset] = []
    for ds in raw_datasets:
        resources = [DCATResource(**r) for r in ds["resources"]]
        if resources:
            result.append(
                DCATDataset(
                    uri=ds["uri"],
                    title=ds.get("title"),
                    description=ds.get("description"),
                    organisation=ds.get("organisation"),
                    author=ds.get("author"),
                    maintainer=ds.get("maintainer"),
                    resources=resources,
                )
            )

    return result


@router.post("", response_model=JobResponse, status_code=202)
async def create_asset(
    edc_id: str,
    body: CreateAssetRequest,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.CREATE_ASSET)),
) -> JobResponse:
    """Submit a create-asset Argo workflow.

    Returns 202 immediately with a job ID; track progress via GET /jobs/{id}/stream.
    """
    edc = await get_edc(edc_id, session)

    if not edc.submodel_server_url and not body.asset_path.startswith("https://"):
        raise HTTPException(
            422,
            "submodel_server_url not configured for this EDC and asset_path is not an HTTPS URL",
        )

    job = Job(
        edc_id=edc_id,
        operation="create_asset",
    )
    session.add(job)
    await session.flush()

    params = {
        "edc_id": edc_id,
        "provider_url": edc.provider_url,
        "provider_submodel_server": edc.submodel_server_url or "",
        "consumer_bpn": body.consumer_bpn,
        "asset_path": body.asset_path,
        "asset_name": body.asset_name,
        "asset_description": body.asset_description,
        "asset_type": body.asset_type,
        "asset_subtype": body.asset_subtype or "",
        "asset_id_short": body.asset_id_short or "",
        "data_address_base_url": body.data_address_base_url or "",
        "data_address_name": body.data_address_name or "",
        "full_policy": str(body.full_policy).lower(),
    }

    workflow_name = await argo_client.submit_workflow(
        template_name=edc.argo_create_asset_template,
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
