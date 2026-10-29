"""Public routes for listing and retrieving EDC configurations."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation, PermissionScope
from app.auth.rbac import get_current_user, require_edc_permission
from app.db.models import EDCConfig, Role, RolePermission, User, UserRole
from app.db.session import get_session
from app.models.edc import EDCResponse

router = APIRouter(prefix="/edcs", tags=["edcs"])


@router.get("", response_model=list[EDCResponse])
async def list_edcs(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[EDCConfig]:
    """Return all EDCs for which the authenticated user has INSPECT_EDC permission."""
    perm_result = await session.execute(
        select(RolePermission.instance)
        .join(Role, RolePermission.role_id == Role.id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(
            UserRole.user_id == user.id,
            RolePermission.scope == PermissionScope.EDC,
            RolePermission.operation == EDCOperation.INSPECT_EDC,
        )
    )
    instances = {row[0] for row in perm_result.all()}

    if not instances:
        return []
    if "*" in instances:
        result = await session.execute(select(EDCConfig))
    else:
        result = await session.execute(select(EDCConfig).where(EDCConfig.id.in_(instances)))
    return list(result.scalars().all())


@router.get("/{edc_id}", response_model=EDCResponse)
async def get_edc(
    edc_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.INSPECT_EDC)),
) -> EDCConfig:
    """Return a single EDC by ID. Requires INSPECT_EDC permission for that EDC."""
    edc = await session.get(EDCConfig, edc_id)
    if not edc:
        raise HTTPException(404, "EDC not found")
    return edc
