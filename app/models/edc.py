"""Pydantic request/response schemas for EDC configuration and BPN registry endpoints."""

from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DCATResource(BaseModel):
    """Single DCAT distribution (resource) within a dataset."""

    uri: str = Field(..., description="URI of the DCAT distribution")
    title: str | None = Field(None, description="Resource title")
    description: str | None = Field(None, description="Resource description")
    mimetype: str | None = Field(None, description="MIME type of the resource")
    download_url: str | None = Field(None, description="Download URL for the resource")


class DCATDataset(BaseModel):
    """DCAT dataset with its associated resources."""

    uri: str = Field(..., description="URI of the DCAT dataset")
    title: str | None = Field(None, description="Dataset title")
    description: str | None = Field(None, description="Dataset description")
    organisation: str | None = Field(None, description="Publisher organisation name")
    author: str | None = Field(None, description="Creator/author name")
    maintainer: str | None = Field(None, description="Maintainer name (vcard:fn)")
    maintainer_email: str | None = Field(
        None, description="Maintainer e-mail (vcard:hasEmail, stripped of mailto: prefix)"
    )
    landing_page: str | None = Field(
        None, description="Dataset landing page URL (dcat:landingPage)"
    )
    resources: list[DCATResource] = Field(
        default_factory=list, description="DCAT distributions of this dataset"
    )


class _UrlMixin(BaseModel):
    """Shared validator that strips trailing slashes from EDC URLs."""

    @field_validator("consumer_url", "provider_url", mode="before", check_fields=False)
    @classmethod
    def strip_trailing_slash(cls, v: str | None) -> str | None:
        """Remove trailing slash from URL values."""
        if v is not None:
            return v.rstrip("/")
        return v


class EDCSecrets(BaseModel):
    """Credentials written to a per-EDC Kubernetes secret."""

    consumer_api_key: str = Field(..., description="API key for the consumer EDC management API")
    provider_api_key: str = Field(..., description="API key for the provider EDC management API")
    client_cert_path: str | None = Field(
        None, description="Path to P12 client certificate for mTLS"
    )
    client_cert_password: str | None = Field(
        None, description="Password for the P12 client certificate"
    )
    oauth2_token_url: str | None = Field(
        None, description="OAuth2 token endpoint for the provider data backend"
    )
    oauth2_client_id: str | None = Field(
        None, description="OAuth2 client ID for the provider data backend"
    )
    oauth2_client_secret_key: str | None = Field(
        None, description="OAuth2 client secret for the provider data backend"
    )
    oauth2_grant_type: str = Field("client_credentials", description="OAuth2 grant type")
    bpn_discovery_client_id: str | None = Field(
        None, description="OAuth2 client ID for BPN Discovery authentication"
    )
    bpn_discovery_client_secret: str | None = Field(
        None, description="OAuth2 client secret for BPN Discovery authentication"
    )
    target_storage_url: str | None = Field(
        None, description="URL of the target storage backend (e.g. CKAN base URL)"
    )
    target_storage_user_key: str | None = Field(
        None, description="User key / API token for the target storage backend"
    )
    target_storage_user_secret: str | None = Field(
        None,
        description="Additional secret for the target storage backend (e.g. owner organisation ID)",
    )
    target_storage_owner_org_id: str | None = Field(
        None,
        description="Owner organisation ID of the target storage backend (e.g. CKAN owner org)",
    )


class EDCCreateRequest(_UrlMixin):
    """Request body for registering a new EDC configuration."""

    id: str = Field(
        ...,
        max_length=237,
        pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$",
        description=(
            "Unique EDC identifier (lowercase, hyphens allowed,"
            " max 237 chars for K8s secret name limit)"
        ),
    )
    display_name: str = Field(..., description="Human-readable name shown in the UI")
    consumer_url: str = Field(..., description="Base URL of the consumer EDC management API")
    provider_url: str = Field(..., description="Base URL of the provider EDC management API")
    base_did: str | None = Field(
        None,
        description=(
            "DID base of the provider — concatenated with provider_bpn"
            " to form counterPartyId (e.g. did:web:example.com)"
        ),
    )
    provider_bpn: str = Field(..., description="Business Partner Number of the provider")
    submodel_server_url: str | None = Field(
        None, description="Submodel server URL for asset uploads"
    )
    bpn_discovery_auth_url: str | None = Field(
        None, description="OAuth2 token endpoint for BPN Discovery authentication"
    )
    bpn_discovery_host: str | None = Field(
        None,
        description="Base URL of the BPN Discovery service",
    )
    bpn_discovery_endpoint: str | None = Field(
        None,
        description="API path of the BPN Discovery endpoint",
    )
    http_timeout: float = Field(
        30.0,
        description=(
            "Timeout in seconds for all outbound HTTP requests"
            " to this EDC and its associated services"
        ),
    )
    sse_poll_interval: int = Field(
        3, description="Interval in seconds between Argo status polls in the SSE job stream"
    )
    use_2025_1: bool = Field(False, description="Use DSP protocol version 2025-1")
    use_edrs: bool = Field(True, description="Use EDR flow for data transfer")
    use_bpn: bool = Field(
        False, description="Use BPN instead of DID as assigner ID in negotiations"
    )
    contract_negotiation_router: str = Field(
        "contractnegotiations",
        description="EDC router for contract negotiations ('contractnegotiations' or 'edrs')",
    )
    provider_dsp_suffix: str = Field(
        "/api/v1/dsp",
        description="URL path suffix appended to provider_url to form the DSP endpoint",
    )
    argo_consume_template: str = Field(
        "consume-asset", description="Argo WorkflowTemplate name for consume operations"
    )
    argo_create_asset_template: str = Field(
        "create-asset", description="Argo WorkflowTemplate name for create-asset operations"
    )
    argo_delete_asset_template: str = Field(
        "delete-asset", description="Argo WorkflowTemplate name for delete-asset operations"
    )
    dcat_catalog_url: str | None = Field(
        None,
        description=(
            "URL of the DCAT catalog TTL for data storage"
            " asset discovery (GET returns text/turtle)"
        ),
    )
    dcat_sparql_query: str | None = Field(
        None,
        description=(
            "SPARQL SELECT query executed against the DCAT catalog;"
            " must project: ?dataset ?dataset_title ?dataset_description"
            " ?organization ?author ?maintainer ?maintainer_email"
            " ?landing_page ?resource ?resource_title"
            " ?resource_description ?mimetype ?download_url"
        ),
    )
    job_output_parameter_whitelist: list[str] | None = Field(
        None,
        description=(
            "Argo output parameter names to expose in JobResponse;"
            " if null all parameters are exposed"
        ),
    )
    job_artifact_whitelist: list[str] = Field(
        default_factory=lambda: ["asset-data"],
        description="Argo artifact names to expose in JobResponse",
    )
    job_asset_artifact_name: str = Field(
        "asset-data",
        description=(
            "Artifact name that contains the consumed asset file;"
            " used to resolve the download filename"
        ),
    )
    job_asset_filename_parameter: str = Field(
        "output_filename",
        description=(
            "Output parameter name that holds the asset filename"
            " with extension; used for Content-Disposition"
        ),
    )
    job_asset_content_type_parameter: str = Field(
        "content_type",
        description=(
            "Output parameter name that holds the MIME content type"
            " of the asset; used as media_type on artifact download"
        ),
    )
    secrets: EDCSecrets = Field(
        ..., description="Credentials written to a K8s secret — never stored in PostgreSQL"
    )


class EDCUpdateRequest(_UrlMixin):
    """Request body for partially updating an EDC configuration."""

    display_name: str | None = Field(None, description="Human-readable name shown in the UI")
    consumer_url: str | None = Field(
        None, description="Base URL of the consumer EDC management API"
    )
    provider_url: str | None = Field(
        None, description="Base URL of the provider EDC management API"
    )
    base_did: str | None = Field(None, description="DID base of the provider")
    provider_bpn: str | None = Field(None, description="Business Partner Number of the provider")
    submodel_server_url: str | None = Field(
        None, description="Submodel server URL for asset uploads"
    )
    bpn_discovery_auth_url: str | None = Field(
        None, description="OAuth2 token endpoint for BPN Discovery authentication"
    )
    bpn_discovery_host: str | None = Field(
        None, description="Base URL of the BPN Discovery service"
    )
    bpn_discovery_endpoint: str | None = Field(
        None, description="API path of the BPN Discovery endpoint"
    )
    http_timeout: float | None = Field(
        None,
        description=(
            "Timeout in seconds for all outbound HTTP requests"
            " to this EDC and its associated services"
        ),
    )
    sse_poll_interval: int | None = Field(
        None, description="Interval in seconds between Argo status polls in the SSE job stream"
    )
    use_2025_1: bool | None = Field(None, description="Use DSP protocol version 2025-1")
    use_edrs: bool | None = Field(None, description="Use EDR flow for data transfer")
    use_bpn: bool | None = Field(None, description="Use BPN instead of DID as assigner ID")
    contract_negotiation_router: str | None = Field(
        None, description="EDC router for contract negotiations"
    )
    provider_dsp_suffix: str | None = Field(
        None, description="URL path suffix appended to provider_url to form the DSP endpoint"
    )
    argo_consume_template: str | None = Field(
        None, description="Argo WorkflowTemplate name for consume operations"
    )
    argo_create_asset_template: str | None = Field(
        None, description="Argo WorkflowTemplate name for create-asset operations"
    )
    argo_delete_asset_template: str | None = Field(
        None, description="Argo WorkflowTemplate name for delete-asset operations"
    )
    dcat_catalog_url: str | None = Field(
        None, description="URL of the DCAT catalog TTL for data storage asset discovery"
    )
    dcat_sparql_query: str | None = Field(
        None, description="SPARQL SELECT query executed against the DCAT catalog"
    )
    job_output_parameter_whitelist: list[str] | None = Field(
        None,
        description=(
            "Argo output parameter names to expose in JobResponse;"
            " if null all parameters are exposed"
        ),
    )
    job_artifact_whitelist: list[str] | None = Field(
        None, description="Argo artifact names to expose in JobResponse"
    )
    job_asset_artifact_name: str | None = Field(
        None, description="Artifact name that contains the consumed asset file"
    )
    job_asset_filename_parameter: str | None = Field(
        None, description="Output parameter name that holds the asset filename with extension"
    )
    job_asset_content_type_parameter: str | None = Field(
        None, description="Output parameter name that holds the MIME content type of the asset"
    )
    secrets: EDCSecrets | None = Field(
        None, description="Updated credentials — replaces the existing K8s secret"
    )


class EDCResponse(_UrlMixin):
    """Response schema for an EDC configuration."""

    id: str = Field(..., description="Unique EDC identifier")
    display_name: str = Field(..., description="Human-readable name")
    consumer_url: str = Field(..., description="Base URL of the consumer EDC management API")
    provider_url: str = Field(..., description="Base URL of the provider EDC management API")
    base_did: str | None = Field(None, description="DID base of the provider")
    provider_bpn: str = Field(..., description="Business Partner Number of the provider")
    submodel_server_url: str | None = Field(
        None, description="Submodel server URL for asset uploads"
    )
    bpn_discovery_auth_url: str | None = Field(
        None, description="OAuth2 token endpoint for BPN Discovery authentication"
    )
    bpn_discovery_host: str | None = Field(
        None, description="Base URL of the BPN Discovery service"
    )
    bpn_discovery_endpoint: str | None = Field(
        None, description="API path of the BPN Discovery endpoint"
    )
    http_timeout: float = Field(
        ...,
        description=(
            "Timeout in seconds for all outbound HTTP requests"
            " to this EDC and its associated services"
        ),
    )
    sse_poll_interval: int = Field(
        ..., description="Interval in seconds between Argo status polls in the SSE job stream"
    )
    use_2025_1: bool = Field(..., description="Whether DSP protocol version 2025-1 is used")
    use_edrs: bool = Field(..., description="Whether the EDR flow is used for data transfer")
    use_bpn: bool = Field(..., description="Whether BPN is used as assigner ID")
    contract_negotiation_router: str = Field(
        ..., description="EDC router for contract negotiations"
    )
    provider_dsp_suffix: str = Field(
        ..., description="URL path suffix appended to provider_url to form the DSP endpoint"
    )
    argo_consume_template: str = Field(
        ..., description="Argo WorkflowTemplate name for consume operations"
    )
    argo_create_asset_template: str = Field(
        ..., description="Argo WorkflowTemplate name for create-asset operations"
    )
    argo_delete_asset_template: str = Field(
        ..., description="Argo WorkflowTemplate name for delete-asset operations"
    )
    dcat_catalog_url: str | None = Field(
        None, description="URL of the DCAT catalog TTL for data storage asset discovery"
    )
    dcat_sparql_query: str | None = Field(
        None, description="SPARQL SELECT query executed against the DCAT catalog"
    )
    job_output_parameter_whitelist: list[str] | None = Field(
        None, description="Argo output parameter names exposed in JobResponse"
    )
    job_artifact_whitelist: list[str] | None = Field(
        None, description="Argo artifact names exposed in JobResponse"
    )
    job_asset_artifact_name: str | None = Field(
        None, description="Artifact name that contains the consumed asset file"
    )
    job_asset_filename_parameter: str | None = Field(
        None, description="Output parameter name that holds the asset filename with extension"
    )
    job_asset_content_type_parameter: str | None = Field(
        None, description="Output parameter name that holds the MIME content type of the asset"
    )
    k8s_secret_name: str = Field(
        ..., description="Name of the K8s secret holding this EDC's credentials"
    )

    model_config = {"from_attributes": True}


class BPNDiscoveryEntry(BaseModel):
    """BPN Discovery result with connector endpoints."""

    bpn: str = Field(..., description="Business Partner Number")
    connectorEndpoint: list[str] = Field(..., description="List of connector DSP endpoint URLs")


class BPNRegistryEntryCreate(BaseModel):
    """Request body for creating a local BPN registry entry."""

    bpn: str = Field(..., description="Business Partner Number")
    connector_endpoints: list[str] = Field(
        ..., min_length=1, description="List of connector DSP endpoint URLs"
    )
    did: str | None = Field(
        None,
        description=(
            "DID base for this partner" " — overrides edc.base_did when constructing provider_did"
        ),
    )
    dsp_suffix: str | None = Field(
        None, description="DSP path suffix for this partner — overrides edc.provider_dsp_suffix"
    )


class BPNRegistryEntryUpdate(BaseModel):
    """Request body for updating a local BPN registry entry."""

    connector_endpoints: list[str] = Field(
        ..., min_length=1, description="Updated list of connector DSP endpoint URLs"
    )
    did: str | None = Field(
        None,
        description=(
            "DID base for this partner" " — overrides edc.base_did when constructing provider_did"
        ),
    )
    dsp_suffix: str | None = Field(
        None, description="DSP path suffix for this partner — overrides edc.provider_dsp_suffix"
    )


class BPNRegistryEntryResponse(BaseModel):
    """Response schema for a local BPN registry entry."""

    id: UUID = Field(..., description="Unique entry identifier")
    edc_id: str = Field(..., description="EDC this entry belongs to")
    bpn: str = Field(..., description="Business Partner Number")
    connector_endpoints: list[str] = Field(..., description="List of connector DSP endpoint URLs")
    did: str | None = Field(None, description="DID base override for this partner")
    dsp_suffix: str | None = Field(None, description="DSP path suffix override for this partner")

    model_config = {"from_attributes": True}
