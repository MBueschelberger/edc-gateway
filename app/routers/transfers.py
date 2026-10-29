"""Routes for querying EDC transfer processes."""

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import User
from app.db.session import get_session
from app.routers.utils import get_edc
from app.services import edc_client

router = APIRouter(prefix="/edcs/{edc_id}/transfers", tags=["transfers"])


@router.get("")
async def list_transfers(
    edc_id: str,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> Response:
    """List all data transfers for the given EDC. Supports pagination via limit/offset."""
    edc = await get_edc(edc_id, session)
    resp = await edc_client.list_transfers(edc, limit=limit, offset=offset)
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@router.get("/{transfer_id}/state")
async def get_transfer_state(
    edc_id: str,
    transfer_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> Response:
    """Return the current state of a specific data transfer."""
    edc = await get_edc(edc_id, session)
    resp = await edc_client.get_transfer_state(edc, transfer_id)
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )
