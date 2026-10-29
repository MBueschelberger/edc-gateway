"""SQLAlchemy ORM models for EDC configurations, users, roles, jobs, and BPN registry."""

from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""


class EDCConfig(Base):
    """Configuration and credentials metadata for a single Eclipse Dataspace Connector."""

    __tablename__ = "edc_configs"

    id = Column(String, primary_key=True)
    display_name = Column(String, nullable=False)
    consumer_url = Column(String, nullable=False)
    provider_url = Column(String, nullable=False)
    base_did = Column(String)
    provider_bpn = Column(String, nullable=False)
    submodel_server_url = Column(String)
    bpn_discovery_auth_url = Column(String)
    bpn_discovery_host = Column(String)
    bpn_discovery_endpoint = Column(String)
    http_timeout = Column(Float, default=30.0, nullable=False)
    sse_poll_interval = Column(Integer, default=3, nullable=False)
    use_2025_1 = Column(Boolean, default=False, nullable=False)
    use_edrs = Column(Boolean, default=True, nullable=False)
    use_bpn = Column(Boolean, default=False, nullable=False)
    contract_negotiation_router = Column(String, default="contractnegotiations", nullable=False)
    provider_dsp_suffix = Column(String, default="/api/v1/dsp", nullable=False)
    argo_consume_template = Column(
        String, nullable=False, default="consume-asset", server_default="consume-asset"
    )
    argo_create_asset_template = Column(
        String, nullable=False, default="create-asset", server_default="create-asset"
    )
    argo_delete_asset_template = Column(
        String, nullable=False, default="delete-asset", server_default="delete-asset"
    )
    dcat_catalog_url = Column(String)
    dcat_sparql_query = Column(Text)
    job_output_parameter_whitelist = Column(ARRAY(String), nullable=True)
    job_artifact_whitelist = Column(ARRAY(String), nullable=True)
    job_asset_artifact_name = Column(String, nullable=True)
    job_asset_filename_parameter = Column(String, nullable=True)
    job_asset_content_type_parameter = Column(String, nullable=True)
    k8s_secret_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    fastapi_secrets = relationship(
        "EDCFastAPISecret", back_populates="edc", cascade="all, delete-orphan"
    )
    bpn_registry_entries = relationship(
        "BPNRegistryEntry", back_populates="edc", cascade="all, delete-orphan"
    )

    @property
    def provider_did(self) -> str:
        """Return the fully-qualified provider DID."""
        return f"{self.base_did}:{self.provider_bpn}" if self.base_did else ""

    @property
    def provider_dsp_url(self) -> str:
        """Return the provider DSP endpoint URL, appending the suffix if needed."""
        if self.provider_url.endswith(self.provider_dsp_suffix):
            return self.provider_url
        return self.provider_url + self.provider_dsp_suffix


class EDCFastAPISecret(Base):
    """Encrypted secrets only needed by FastAPI (not by Argo pods)."""

    __tablename__ = "edc_fastapi_secrets"

    edc_id = Column(String, ForeignKey("edc_configs.id", ondelete="CASCADE"), primary_key=True)
    secret_type = Column(String, primary_key=True)
    encrypted_value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    edc = relationship("EDCConfig", back_populates="fastapi_secrets")


class User(Base):
    """An authenticated user, auto-provisioned on first Keycloak login."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    sub = Column(String, unique=True, nullable=False)
    email = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")


class Role(Base):
    """Named role that groups one or more permissions."""

    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    role_permissions = relationship(
        "RolePermission", back_populates="role", cascade="all, delete-orphan"
    )
    user_roles = relationship("UserRole", back_populates="role")


class UserRole(Base):
    """Association table linking users to roles."""

    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id"),)

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id = Column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )

    user = relationship("User", back_populates="user_roles")
    role = relationship("Role", back_populates="user_roles")


class RolePermission(Base):
    """Single permission entry (scope/instance/operation) attached to a role."""

    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "scope", "instance", "operation"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    scope = Column(String, nullable=False)
    instance = Column(String, nullable=False)
    operation = Column(String, nullable=False)

    role = relationship("Role", back_populates="role_permissions")


class BPNRegistryEntry(Base):
    """Locally cached BPN discovery result with associated connector endpoints."""

    __tablename__ = "bpn_registry_entries"
    __table_args__ = (UniqueConstraint("edc_id", "bpn"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    edc_id = Column(String, ForeignKey("edc_configs.id", ondelete="CASCADE"), nullable=False)
    bpn = Column(String, nullable=False)
    did = Column(String, nullable=True)
    dsp_suffix = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    edc = relationship("EDCConfig", back_populates="bpn_registry_entries")
    endpoints = relationship(
        "BPNRegistryEndpoint", back_populates="entry", cascade="all, delete-orphan"
    )

    @property
    def connector_endpoints(self) -> list[str]:
        """Return all endpoint URLs for this BPN entry."""
        return [e.url for e in self.endpoints]


class BPNRegistryEndpoint(Base):
    """Single connector endpoint URL belonging to a BPN registry entry."""

    __tablename__ = "bpn_registry_endpoints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    entry_id = Column(
        UUID(as_uuid=True),
        ForeignKey("bpn_registry_entries.id", ondelete="CASCADE"),
        nullable=False,
    )
    url = Column(String, nullable=False)

    entry = relationship("BPNRegistryEntry", back_populates="endpoints")


class Job(Base):
    """Record of an Argo-backed async operation (consume, create-asset, delete-asset)."""

    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    argo_workflow_name = Column(String)
    edc_id = Column(String, ForeignKey("edc_configs.id", ondelete="SET NULL"))
    operation = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
