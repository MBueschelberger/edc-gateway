"""Routes for querying EDC contract negotiations."""

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import User
from app.db.session import get_session
from app.routers.utils import get_edc
from app.services import edc_client

router = APIRouter(prefix="/edcs/{edc_id}/negotiations", tags=["negotiations"])


@router.get("")
async def list_negotiations(
    edc_id: str,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> Response:
    """List all contract negotiations for the given EDC. Supports pagination via limit/offset."""
    edc = await get_edc(edc_id, session)
    resp = await edc_client.list_negotiations(edc, limit=limit, offset=offset)
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@router.get("/{negotiation_id}")
async def get_negotiation(
    edc_id: str,
    negotiation_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> Response:
    """Return the current state of a specific contract negotiation."""
    edc = await get_edc(edc_id, session)
    resp = await edc_client.get_negotiation(edc, negotiation_id)
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )
