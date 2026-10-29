"""Pydantic request/response schemas for users, roles, and permissions."""

from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.auth.permissions import EDCOperation, PermissionScope, UserOperation


class PermissionCreate(BaseModel):
    """Request body for creating a single permission entry."""

    scope: PermissionScope = Field(..., description="Permission scope: 'edc' or 'user'")
    instance: str = Field(
        ..., description="Resource instance: '*' for wildcard, or an EDC ID for the 'edc' scope"
    )
    operation: str = Field(
        ..., description="Operation to permit — must match valid operations for the given scope"
    )

    @model_validator(mode="after")
    def validate_scope_constraints(self) -> "PermissionCreate":
        """Ensure operation is valid for the given scope."""
        if self.scope == PermissionScope.USER:
            if self.instance != "*":
                raise ValueError("user scope only supports wildcard instance ('*')")
            if self.operation not in {op.value for op in UserOperation}:
                raise ValueError(f"invalid operation for user scope: {self.operation!r}")
        elif self.scope == PermissionScope.EDC:
            if self.operation not in {op.value for op in EDCOperation}:
                raise ValueError(f"invalid operation for edc scope: {self.operation!r}")
        return self


class PermissionResponse(BaseModel):
    """Response schema for a single permission entry."""

    id: UUID = Field(..., description="Unique permission ID")
    scope: PermissionScope = Field(..., description="Permission scope")
    instance: str = Field(..., description="Resource instance: '*' or a specific EDC ID")
    operation: str = Field(..., description="Operation")


class UserResponse(BaseModel):
    """Response schema for a user with their assigned roles."""

    id: UUID = Field(..., description="Internal user ID")
    sub: str = Field(..., description="JWT subject claim (Keycloak user ID)")
    email: str | None = Field(None, description="User email from JWT")
    roles: list["RoleResponse"] = Field(..., description="Roles assigned to this user")


class RoleCreateRequest(BaseModel):
    """Request body for creating a new role with permissions."""

    name: str = Field(..., description="Unique role name (e.g. 'operator-catena-x')")
    description: str = Field("", description="Human-readable description of this role")
    permissions: list[PermissionCreate] = Field(
        [], description="Permissions to assign to this role"
    )


class RoleResponse(BaseModel):
    """Response schema for a role with its permissions."""

    id: UUID = Field(..., description="Internal role ID")
    name: str = Field(..., description="Unique role name")
    description: str | None = Field(None, description="Human-readable description")
    permissions: list[PermissionResponse] = Field(
        ..., description="Permissions assigned to this role"
    )


class RoleUpdateRequest(BaseModel):
    """Request body for replacing a role's name, description, and permissions."""

    name: str = Field(..., description="Unique role name (e.g. 'operator-catena-x')")
    description: str = Field("", description="Human-readable description of this role")
    permissions: list[PermissionCreate] = Field(
        [], description="Permissions — replaces all existing permissions for this role"
    )


class AssignRolesRequest(BaseModel):
    """Request body for replacing a user's role assignments."""

    role_ids: list[UUID] = Field(
        ...,
        description=(
            "List of role IDs to assign" " — replaces all existing role assignments for this user"
        ),
    )
