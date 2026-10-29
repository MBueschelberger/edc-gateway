"""Routes for listing, retrieving, and deleting jobs and their Argo artifacts."""

import logging
import os
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import EDCConfig, Job, User
from app.db.session import get_session
from app.models.job import BulkDeleteRequest, JobResponse
from app.services import argo_client
from app.services.argo_client import ArgoPhase

logger = logging.getLogger(__name__)

job_router = APIRouter(prefix="/jobs", tags=["jobs"])


def _apply_output_whitelist(meta: dict, edc: EDCConfig | None) -> None:
    """Filter outputs.parameters and outputs.artifacts in-place based on EDC whitelist config."""
    if not meta.get("outputs") or not edc:
        return
    outputs = meta["outputs"]
    if edc.job_output_parameter_whitelist is not None:
        allowed = set(edc.job_output_parameter_whitelist)
        outputs["parameters"] = [p for p in outputs.get("parameters", []) if p["name"] in allowed]
    if edc.job_artifact_whitelist is not None:
        allowed = set(edc.job_artifact_whitelist)
        outputs["artifacts"] = [a for a in outputs.get("artifacts", []) if a["name"] in allowed]


@job_router.get("", response_model=list[JobResponse])
async def list_jobs(
    edc_id: str = Query(..., description="EDC ID whose jobs to list"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of jobs to return"),
    offset: int = Query(0, ge=0, description="Number of jobs to skip"),
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> list[JobResponse]:
    """List all jobs for the given EDC.

    Requires STATUS permission for that EDC. Supports pagination via limit/offset.
    """

    result = await session.execute(
        select(Job)
        .where(Job.edc_id == edc_id)
        .order_by(Job.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    jobs = list(result.scalars().all())
    edc = await session.get(EDCConfig, edc_id)

    responses = []
    for job in jobs:
        data = {
            "id": job.id,
            "edc_id": job.edc_id,
            "operation": job.operation,
            "argo_workflow_name": job.argo_workflow_name,
            "created_at": job.created_at,
        }
        if job.argo_workflow_name:
            try:
                meta = await argo_client.get_workflow_metadata(job.argo_workflow_name)
                _apply_output_whitelist(meta, edc)
                data.update(meta)
            except Exception:  # pylint: disable=broad-exception-caught
                logger.warning("Failed to fetch Argo metadata for %s", job.argo_workflow_name)
        responses.append(JobResponse(**data))
    return responses


@job_router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> JobResponse:
    """Return the current status of a specific job, enriched with live Argo workflow metadata."""
    job = await session.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    edc = await session.get(EDCConfig, job.edc_id) if job.edc_id else None
    data = {
        "id": job.id,
        "edc_id": job.edc_id,
        "operation": job.operation,
        "argo_workflow_name": job.argo_workflow_name,
        "created_at": job.created_at,
    }
    if job.argo_workflow_name:
        try:
            meta = await argo_client.get_workflow_metadata(job.argo_workflow_name)
            _apply_output_whitelist(meta, edc)
            data.update(meta)
        except Exception as exc:
            raise HTTPException(502, f"Could not fetch job status from Argo: {exc}") from exc
    return JobResponse(**data)


@job_router.delete("", status_code=204)
async def bulk_delete_jobs(
    body: BulkDeleteRequest,
    edc_id: str = Query(..., description="EDC ID — used for permission check and scoping"),
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> None:
    """Delete multiple job records from PostgreSQL in a single query.

    Only jobs that belong to the given EDC are deleted — IDs belonging to
    other EDCs are silently ignored. Argo workflows are not affected.
    """
    await session.execute(delete(Job).where(Job.id.in_(body.ids), Job.edc_id == edc_id))
    await session.commit()


@job_router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> None:
    """Delete a job record from PostgreSQL. The Argo workflow in Kubernetes is not affected."""
    job = await session.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    await session.delete(job)
    await session.commit()


@job_router.get("/{job_id}/logs")
async def get_job_logs(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> list[str]:
    """Return the logs of a job's Argo workflow.

    Works for running, completed, and archived workflows.
    """
    job = await session.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if not job.argo_workflow_name:
        raise HTTPException(404, "No Argo workflow associated with this job")
    try:
        return await argo_client.fetch_workflow_logs(job.argo_workflow_name)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Could not fetch logs from Argo: {exc}") from exc


@job_router.get("/{job_id}/artifacts/{artifact_name}")
async def get_job_artifact_file(  # pylint: disable=too-many-branches
    job_id: UUID,
    artifact_name: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> Response:
    """Download a specific artifact from a succeeded job as a file.

    For consume-asset jobs use artifact_name ``asset-data``.
    Available artifact names are listed in the outputs.artifacts field of GET /jobs/{job_id}.
    """
    job = await session.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if not job.argo_workflow_name:
        raise HTTPException(404, "No Argo workflow associated with this job")
    try:
        phase = await argo_client.get_workflow_phase(job.argo_workflow_name)
    except Exception as exc:
        raise HTTPException(502, f"Could not fetch workflow status from Argo: {exc}") from exc
    if phase in (ArgoPhase.FAILED, ArgoPhase.ERROR):
        raise HTTPException(400, "Workflow failed — no artifact available")
    if phase is not ArgoPhase.SUCCEEDED:
        raise HTTPException(409, f"Workflow has not succeeded yet (phase: {phase})")
    edc = await session.get(EDCConfig, job.edc_id) if job.edc_id else None
    if (
        edc
        and edc.job_artifact_whitelist is not None
        and artifact_name not in edc.job_artifact_whitelist
    ):
        raise HTTPException(
            403, f"Artifact '{artifact_name}' is not in the allowed artifact list for this EDC"
        )
    try:
        content = await argo_client.fetch_artifact_bytes(job.argo_workflow_name, artifact_name)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Could not fetch artifact from Argo: {exc}") from exc
    download_name = artifact_name
    content_type = "application/octet-stream"
    if edc and edc.job_asset_artifact_name and artifact_name == edc.job_asset_artifact_name:
        try:
            params = await argo_client.get_workflow_output_parameters(job.argo_workflow_name)
            if edc.job_asset_filename_parameter:
                raw = params.get(edc.job_asset_filename_parameter, "")
                if raw:
                    download_name = os.path.basename(raw)
            if edc.job_asset_content_type_parameter:
                raw_ct = params.get(edc.job_asset_content_type_parameter, "")
                if raw_ct:
                    content_type = raw_ct
        except Exception:  # pylint: disable=broad-exception-caught
            logger.warning("Failed to resolve artifact metadata for %s", job.argo_workflow_name)
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )
