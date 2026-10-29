"""FastAPI application entry point: lifespan, middleware, and router registration."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.db.models import Base
from app.db.session import engine
from app.routers import (
    assets,
    bpn_discovery,
    catalog,
    consume,
    delete_asset,
    edcs,
    edrs,
    negotiations,
    transfers,
)
from app.routers.admin import edcs as admin_edcs
from app.routers.admin import users as admin_users
from app.routers.jobs import job_router

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create database tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="EDC Gateway",
    description="Microservice gateway for interacting with multiple Eclipse Dataspace Connectors",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.external_hostname] if settings.external_hostname else ["*"],
    allow_credentials=bool(settings.external_hostname),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(edcs.router)
app.include_router(catalog.router)
app.include_router(bpn_discovery.router)
app.include_router(negotiations.router)
app.include_router(edrs.router)
app.include_router(transfers.router)
app.include_router(consume.router)
app.include_router(assets.router)
app.include_router(delete_asset.router)
app.include_router(job_router)
app.include_router(admin_edcs.router)
app.include_router(admin_users.router)


@app.get("/health", tags=["health"])
async def health() -> dict:
    """Return a simple health-check response."""
    return {"status": "ok"}
