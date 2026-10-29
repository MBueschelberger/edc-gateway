"""Pydantic request/response schemas for jobs and Argo workflow operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WorkflowParameter(BaseModel):
    """Single name/value pair from Argo workflow inputs or outputs."""

    name: str = Field(..., description="Parameter name")
    value: str | None = Field(None, description="Parameter value")


class WorkflowArtifactInfo(BaseModel):
    """Metadata stub for a single Argo workflow artifact."""

    name: str = Field(..., description="Artifact name")


class WorkflowInputs(BaseModel):
    """Input parameters passed to an Argo workflow."""

    parameters: list[WorkflowParameter] = Field(
        default_factory=list, description="Input parameters passed to the workflow"
    )


class WorkflowOutputs(BaseModel):
    """Output parameters and artifacts produced by an Argo workflow."""

    parameters: list[WorkflowParameter] = Field(
        default_factory=list, description="Output parameters produced by the workflow"
    )
    artifacts: list[WorkflowArtifactInfo] = Field(
        default_factory=list, description="Output artifacts (excluding main-logs)"
    )
    exit_code: str | None = Field(None, description="Container exit code")


class JobResponse(BaseModel):
    """Response schema for a job, enriched with live Argo workflow metadata."""

    id: UUID = Field(..., description="Unique job ID")
    edc_id: str | None = Field(None, description="ID of the EDC this job targets")
    operation: str = Field(..., description="Operation type: 'consume' or 'create_asset'")
    argo_workflow_name: str | None = Field(None, description="Name of the Argo workflow resource")
    created_at: datetime = Field(..., description="Timestamp when the job was created")
    # Live data fetched from Argo — absent when the job was just submitted
    phase: str | None = Field(
        None, description="Raw Argo phase: Pending | Running | Succeeded | Failed | Error"
    )
    status: str | None = Field(
        None, description="Gateway-mapped status: pending | running | succeeded | failed"
    )
    started_at: datetime | None = Field(
        None, description="Timestamp when the Argo workflow started"
    )
    finished_at: datetime | None = Field(
        None, description="Timestamp when the Argo workflow finished"
    )
    progress: str | None = Field(None, description="Argo progress string, e.g. '1/2'")
    message: str | None = Field(None, description="Human-readable status message from Argo")
    inputs: WorkflowInputs | None = Field(None, description="Workflow input parameters")
    outputs: WorkflowOutputs | None = Field(
        None, description="Workflow output parameters and artifacts"
    )

    model_config = {"from_attributes": True}


class BulkDeleteRequest(BaseModel):
    """Request body for deleting multiple jobs at once."""

    ids: list[UUID] = Field(..., description="List of job IDs to delete", min_length=1)


class ConsumeAssetRequest(BaseModel):
    """Request body for consuming an EDC asset via Argo workflow."""

    asset_id: str = Field(..., description="ID of the asset to consume (e.g. urn:uuid:...)")
    provider_bpn: str | None = Field(None, description="Override the EDC's default provider BPN")
    provider_dsp_url: str | None = Field(
        None, description="Override the EDC's default provider DSP URL"
    )
    use_edrs: bool | None = Field(None, description="Override the EDC's EDR flow flag")
    add_membership: bool = Field(
        False, description="Add Membership:active constraint to the negotiation policy"
    )
    debug: bool = Field(False, description="Enable verbose debug output in the Argo workflow logs")


class DeleteAssetRequest(BaseModel):
    """Request body for deleting a provider EDC asset via Argo workflow."""

    asset_id: str = Field(
        ..., description="Full asset ID as it appears in the EDC catalog (e.g. urn:uuid:...)"
    )
    debug: bool = Field(False, description="Enable verbose debug output in the Argo workflow logs")


class CreateAssetRequest(BaseModel):
    """Request body for registering a new asset in a provider EDC via Argo workflow."""

    asset_name: str = Field(..., description="Human-readable asset name")
    asset_description: str = Field("", description="Asset description")
    asset_type: str = Field("application/json", description="MIME type of the asset content")
    asset_path: str = Field(..., description="HTTPS URL or filesystem path to the asset data")
    asset_subtype: str | None = Field(None, description="Optional asset subtype property")
    asset_id_short: str | None = Field(
        None, description="Optional idShort property for AAS compatibility"
    )
    data_address_base_url: str | None = Field(
        None, description="Backend base URL for the DataAddress (OAuth2 mode)"
    )
    data_address_name: str | None = Field(
        None, description="Backend name for the DataAddress (OAuth2 mode)"
    )
    consumer_bpn: str = Field(
        ..., description="BPN of the consumer who is allowed to access this asset"
    )
    full_policy: bool = Field(
        False,
        description=(
            "Use full Catena-X policy (Membership + FrameworkAgreement + BPN)"
            " instead of simplified BPN-only policy"
        ),
    )
