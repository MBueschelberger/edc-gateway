"""Routes for querying EDR (Endpoint Data Reference) transfers."""

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import EDCOperation
from app.auth.rbac import require_edc_permission
from app.db.models import User
from app.db.session import get_session
from app.routers.utils import get_edc
from app.services import edc_client

router = APIRouter(prefix="/edcs/{edc_id}/edrs", tags=["edrs"])


@router.get("")
async def list_edrs(
    edc_id: str,
    agreement_id: str | None = None,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> Response:
    """List all Endpoint Data References for the given EDC, optionally filtered by agreement_id."""
    edc = await get_edc(edc_id, session)
    resp = await edc_client.list_edrs(edc, agreement_id=agreement_id)
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@router.get("/{edr_id}/dataaddress")
async def get_edr_dataaddress(
    edc_id: str,
    edr_id: str,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_edc_permission(EDCOperation.STATUS)),
) -> Response:
    """Return the data address for a specific EDR transfer process."""
    edc = await get_edc(edc_id, session)
    resp = await edc_client.get_edr_dataaddress(edc, edr_id)
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )
