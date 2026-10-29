"""Admin routes for user, role, and permission management."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.oauth2 import security, verify_token
from app.auth.permissions import EDCOperation, PermissionScope, UserOperation
from app.auth.rbac import get_current_user, has_permission, require_permission
from app.config.settings import settings
from app.db.models import Role, RolePermission, User, UserRole
from app.db.session import get_session
from app.models.user import (
    AssignRolesRequest,
    PermissionResponse,
    RoleCreateRequest,
    RoleResponse,
    RoleUpdateRequest,
    UserResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/permission-options", response_model=dict[str, list[str]])
async def list_permission_options(
    _: User = Depends(require_permission(PermissionScope.USER, "*", UserOperation.MANAGE)),
) -> dict[str, list[str]]:
    """Return all valid scopes and their allowed operations. No authentication required."""
    return {
        PermissionScope.EDC: [op.value for op in EDCOperation],
        PermissionScope.USER: [op.value for op in UserOperation],
    }


async def _user_roles(user_id: UUID, session: AsyncSession) -> list[RoleResponse]:
    result = await session.execute(
        select(Role).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user_id)
    )
    roles = result.scalars().all()
    return [
        RoleResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            permissions=await _role_permissions(r.id, session),
        )
        for r in roles
    ]


async def _role_permissions(role_id: UUID, session: AsyncSession) -> list[PermissionResponse]:
    result = await session.execute(select(RolePermission).where(RolePermission.role_id == role_id))
    return [
        PermissionResponse(id=rp.id, scope=rp.scope, instance=rp.instance, operation=rp.operation)
        for rp in result.scalars().all()
    ]


@router.post("/bootstrap", response_model=UserResponse, status_code=201)
async def bootstrap_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
):
    """Create the first admin role and assign it to the calling user.

    Returns 409 if an admin permission already exists.
    """
    existing = await session.execute(
        select(Role).where(Role.name == settings.bootstrap_admin_role).limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail="Bootstrap already completed — an admin role already exists"
        )

    payload = await verify_token(credentials)
    sub = payload.get("sub")

    result = await session.execute(select(User).where(User.sub == sub))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(sub=sub, email=payload.get("email"))
        session.add(user)
        await session.flush()

    role = Role(name=settings.bootstrap_admin_role, description="System administrator")
    session.add(role)
    await session.flush()

    session.add(
        RolePermission(
            role_id=role.id,
            scope=PermissionScope.USER,
            instance="*",
            operation=UserOperation.MANAGE,
        )
    )
    session.add(UserRole(user_id=user.id, role_id=role.id))
    await session.commit()

    return UserResponse(
        id=user.id,
        sub=user.sub,
        email=user.email,
        roles=await _user_roles(user.id, session),
    )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PermissionScope.USER, "*", UserOperation.MANAGE)),
):
    """List all users with their assigned roles."""
    result = await session.execute(select(User))
    users = result.scalars().all()
    return [
        UserResponse(id=u.id, sub=u.sub, email=u.email, roles=await _user_roles(u.id, session))
        for u in users
    ]


@router.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return the profile of the currently authenticated user."""
    return UserResponse(
        id=current_user.id,
        sub=current_user.sub,
        email=current_user.email,
        roles=await _user_roles(current_user.id, session),
    )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Return a single user with their assigned roles.

    Admins may fetch any user; regular users may only fetch themselves.
    """
    if current_user.id != user_id and not await has_permission(
        current_user, session, PermissionScope.USER, "*", UserOperation.MANAGE
    ):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return UserResponse(
        id=user.id, sub=user.sub, email=user.email, roles=await _user_roles(user_id, session)
    )


@router.put("/users/{user_id}/roles", response_model=UserResponse)
async def assign_roles(
    user_id: UUID,
    body: AssignRolesRequest,
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PermissionScope.USER, "*", UserOperation.MANAGE)),
):
    """Replace the user's current roles with the provided list."""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    admin_role_result = await session.execute(
        select(Role).where(Role.name == settings.bootstrap_admin_role).limit(1)
    )
    admin_role = admin_role_result.scalar_one()
    if admin_role.id not in body.role_ids:
        current_admin_ur = await session.execute(
            select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == admin_role.id)
        )
        if current_admin_ur.scalar_one_or_none() is not None:
            other_holder = await session.execute(
                select(UserRole)
                .where(
                    UserRole.role_id == admin_role.id,
                    UserRole.user_id != user_id,
                )
                .limit(1)
            )
            if other_holder.scalar_one_or_none() is None:
                raise HTTPException(
                    409,
                    "Cannot remove the bootstrap admin role — this user is the last holder",
                )

    existing = await session.execute(select(UserRole).where(UserRole.user_id == user_id))
    for ur in existing.scalars().all():
        await session.delete(ur)

    await session.flush()

    for role_id in body.role_ids:
        if not await session.get(Role, role_id):
            raise HTTPException(404, f"Role {role_id} not found")
        session.add(UserRole(user_id=user_id, role_id=role_id))

    await session.commit()
    return UserResponse(
        id=user.id, sub=user.sub, email=user.email, roles=await _user_roles(user_id, session)
    )


@router.post("/roles", response_model=RoleResponse, status_code=201)
async def create_role(
    body: RoleCreateRequest,
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PermissionScope.USER, "*", UserOperation.MANAGE)),
):
    """Create a new role with the given name, description, and initial permissions."""
    existing = await session.execute(select(Role).where(Role.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Role '{body.name}' already exists")

    role = Role(name=body.name, description=body.description)
    session.add(role)
    await session.flush()
    for perm in body.permissions:
        session.add(
            RolePermission(
                role_id=role.id,
                scope=perm.scope,
                instance=perm.instance,
                operation=perm.operation,
            )
        )
    await session.commit()
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=await _role_permissions(role.id, session),
    )


@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PermissionScope.USER, "*", UserOperation.MANAGE)),
):
    """List all roles with their permissions."""
    result = await session.execute(select(Role))
    roles = result.scalars().all()
    return [
        RoleResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            permissions=await _role_permissions(r.id, session),
        )
        for r in roles
    ]


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    body: RoleUpdateRequest,
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PermissionScope.USER, "*", UserOperation.MANAGE)),
):
    """Fully replace a role's name, description, and permissions."""
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")

    if body.name != role.name:
        conflict = await session.execute(select(Role).where(Role.name == body.name))
        if conflict.scalar_one_or_none():
            raise HTTPException(409, f"Role '{body.name}' already exists")

    if role.name == settings.bootstrap_admin_role:
        has_manage = any(
            p.scope == PermissionScope.USER
            and p.instance == "*"
            and p.operation == UserOperation.MANAGE
            for p in body.permissions
        )
        if not has_manage:
            raise HTTPException(
                409, "Cannot remove user:*:manage permission from the bootstrap admin role"
            )

    role.name = body.name
    role.description = body.description

    existing_perms = await session.execute(
        select(RolePermission).where(RolePermission.role_id == role_id)
    )
    for rp in existing_perms.scalars().all():
        await session.delete(rp)

    await session.flush()

    for perm in body.permissions:
        session.add(
            RolePermission(
                role_id=role_id,
                scope=perm.scope,
                instance=perm.instance,
                operation=perm.operation,
            )
        )

    await session.commit()
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=await _role_permissions(role_id, session),
    )


@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(
    role_id: UUID,
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PermissionScope.USER, "*", UserOperation.MANAGE)),
):
    """Delete a role and all its associated permissions."""
    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    if role.name == settings.bootstrap_admin_role:
        raise HTTPException(409, "Cannot delete the bootstrap admin role")
    await session.delete(role)
    await session.commit()
