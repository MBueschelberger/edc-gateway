"""RBAC helpers: user resolution, permission checks, and FastAPI dependency factories."""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.oauth2 import security, verify_token
from app.auth.permissions import EDCOperation, PermissionScope, UserOperation
from app.db.models import Role, RolePermission, User, UserRole
from app.db.session import get_session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Return the current user, auto-provisioning on first login."""
    payload = await verify_token(credentials)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub claim"
        )

    result = await session.execute(select(User).where(User.sub == sub))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(sub=sub, email=payload.get("email"))
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return user


async def has_permission(
    user: User,
    session: AsyncSession,
    scope: str,
    instance: str,
    operation: str,
) -> bool:
    """Check whether *user* holds a permission matching scope/instance/operation."""
    instances = [instance, "*"] if instance != "*" else ["*"]
    result = await session.execute(
        select(RolePermission.id)
        .join(Role, RolePermission.role_id == Role.id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == user.id,
            RolePermission.scope == scope,
            RolePermission.instance.in_(instances),
            RolePermission.operation == operation,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


def require_permission(
    scope: PermissionScope, instance: str, operation: UserOperation | EDCOperation
) -> Callable:
    """Static permission check — use for non-EDC-specific routes like admin endpoints."""

    async def check(
        user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_session),
    ) -> User:
        if not await has_permission(user, session, scope, instance, operation):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        return user

    return check


def require_edc_permission(operation: EDCOperation) -> Callable:
    """Dynamic permission check — reads edc_id from the path and queries the DB directly."""

    async def check(
        edc_id: str,
        user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_session),
    ) -> User:
        if not await has_permission(user, session, PermissionScope.EDC, edc_id, operation):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        return user

    return check
