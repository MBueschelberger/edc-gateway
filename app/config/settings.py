"""Application settings loaded from environment variables via pydantic-settings."""

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the EDC Gateway, populated from env vars."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    edc_gateway_postgres_user: str = Field(..., description="PostgreSQL username")
    edc_gateway_postgres_secret: str = Field(..., description="PostgreSQL password")
    edc_gateway_postgres_host: str = Field("localhost", description="PostgreSQL host")
    edc_gateway_postgres_port: int = Field(5432, description="PostgreSQL port")
    edc_gateway_postgres_db: str = Field(..., description="PostgreSQL database name")

    @computed_field
    @property
    def database_url(self) -> str:
        """Build the async PostgreSQL connection URL from individual components."""
        return (
            f"postgresql+asyncpg://{self.edc_gateway_postgres_user}:"
            f"{self.edc_gateway_postgres_secret}@{self.edc_gateway_postgres_host}:"
            f"{self.edc_gateway_postgres_port}/{self.edc_gateway_postgres_db}"
        )

    oidc_jwks_url: str = Field(
        ...,
        description="Keycloak JWKS endpoint URL",
    )
    oidc_issuer: str = Field(
        ..., description="Expected JWT issuer, must match the Keycloak realm URL"
    )
    oidc_audience: str = Field(
        "", description="Expected JWT audience claim (leave empty to skip audience check)"
    )
    oidc_timeout: float = Field(10.0, description="Timeout in seconds for JWKS fetch requests")

    k8s_namespace: str = Field(
        "edc-gateway", description="Kubernetes namespace where EDC credential secrets are stored"
    )
    k8s_in_cluster: bool = Field(
        True, description="True when running inside Kubernetes; False for local dev with kubeconfig"
    )

    argo_server_url: str = Field(
        ..., description="Base URL of the Argo Workflows server, e.g. https://argo.example.com"
    )
    argo_namespace: str = Field("argo", description="Kubernetes namespace where Argo workflows run")
    argo_workflow_sa: str = Field(
        "edc-gateway-workflow", description="ServiceAccount used by Argo workflow pods"
    )
    argo_consume_template: str = Field(
        "consume-asset", description="WorkflowTemplate name for consume-asset operations"
    )
    argo_create_asset_template: str = Field(
        "create-asset", description="WorkflowTemplate name for create-asset operations"
    )
    argo_delete_asset_template: str = Field(
        "delete-asset", description="WorkflowTemplate name for delete-asset operations"
    )
    argo_timeout: float = Field(30.0, description="Timeout in seconds for Argo REST API calls")
    argo_verify_ssl: bool = Field(
        True,
        description="Verify TLS certificate of the Argo server (set False for self-signed certs)",
    )

    log_level: str = Field("INFO", description="Python logging level (DEBUG, INFO, WARNING, ERROR)")

    bootstrap_admin_role: str = Field(
        "admin", description="Name of the root admin role created by POST /admin/bootstrap"
    )

    external_hostname: str = Field(
        "",
        description=(
            "Publicly accessible origin of this gateway"
            " (e.g. https://api.example.com)."
            " Restricts CORS to this origin with credentials."
            " When empty, all origins are allowed without credentials."
        ),
    )


settings = Settings()
