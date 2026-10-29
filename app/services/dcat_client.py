"""DCAT catalog client — fetches, parses, and queries RDF catalogs via SPARQL."""

import asyncio
import logging
from functools import partial

import httpx
from fastapi import HTTPException
from rdflib import Graph

from app.db.models import EDCConfig
from app.services import edc_client

logger = logging.getLogger(__name__)


def _parse_and_query(  # pylint: disable=too-many-locals,too-many-branches
    ttl_content: str, sparql_query: str
) -> list[dict]:
    g = Graph()
    g.parse(data=ttl_content, format="turtle")

    qres = g.query(sparql_query)
    vars_list = [str(v) for v in qres.vars]

    datasets: dict[str, dict] = {}
    for row in qres:
        d: dict[str, str | None] = {}
        for var in vars_list:
            val = getattr(row, var, None)
            d[var] = str(val) if val is not None else None

        dataset_uri = d.get("dataset")
        if not dataset_uri:
            continue

        raw_email = d.get("maintainer_email")
        maintainer_email = raw_email.removeprefix("mailto:") if raw_email else None

        if dataset_uri not in datasets:
            datasets[dataset_uri] = {
                "uri": dataset_uri,
                "title": d.get("dataset_title"),
                "description": d.get("dataset_description"),
                "organisation": d.get("organization"),
                "author": d.get("author"),
                "maintainer": d.get("maintainer"),
                "maintainer_email": maintainer_email,
                "landing_page": d.get("landing_page"),
                "resources": {},
            }
        else:
            ds = datasets[dataset_uri]
            if not ds["title"] and d.get("dataset_title"):
                ds["title"] = d["dataset_title"]
            if not ds["description"] and d.get("dataset_description"):
                ds["description"] = d["dataset_description"]
            if not ds["organisation"] and d.get("organization"):
                ds["organisation"] = d["organization"]
            if not ds["author"] and d.get("author"):
                ds["author"] = d["author"]
            if not ds["maintainer"] and d.get("maintainer"):
                ds["maintainer"] = d["maintainer"]
            if not ds["maintainer_email"] and maintainer_email:
                ds["maintainer_email"] = maintainer_email
            if not ds["landing_page"] and d.get("landing_page"):
                ds["landing_page"] = d["landing_page"]

        resource_uri = d.get("resource")
        if resource_uri and resource_uri not in datasets[dataset_uri]["resources"]:
            datasets[dataset_uri]["resources"][resource_uri] = {
                "uri": resource_uri,
                "title": d.get("resource_title"),
                "description": d.get("resource_description"),
                "mimetype": d.get("mimetype"),
                "download_url": d.get("download_url"),
            }

    result = []
    for ds in datasets.values():
        ds["resources"] = list(ds["resources"].values())
        result.append(ds)
    return result


async def fetch_dcat_datasets(edc: EDCConfig) -> list[dict]:
    """Download and parse the DCAT catalog for the given EDC."""
    try:
        async with httpx.AsyncClient(timeout=edc.http_timeout) as client:
            resp = await client.get(edc.dcat_catalog_url)
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Failed to download DCAT catalog: {e}") from e
    except httpx.RequestError as e:
        raise HTTPException(502, f"Network error downloading DCAT catalog: {e}") from e

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, partial(_parse_and_query, resp.text, edc.dcat_sparql_query)
        )
    except Exception as e:  # pylint: disable=broad-exception-caught
        raise HTTPException(
            500, f"Failed to parse DCAT catalog or execute SPARQL query: {e}"
        ) from e


async def fetch_registered_download_urls(edc: EDCConfig) -> set[str]:
    """Return download URLs already registered as EDC provider assets.

    Returns empty set on any error.
    """
    try:
        resp = await edc_client.list_provider_assets(edc)
        if resp.is_error:
            return set()
        assets = resp.json()
        urls: set[str] = set()
        for asset in assets if isinstance(assets, list) else []:
            da: dict = asset.get("edc:dataAddress") or asset.get("dataAddress") or {}
            for key in ("edc:baseUrl", "baseUrl", "edc:proxyPath", "proxyPath"):
                url = da.get(key)
                if url:
                    urls.add(url)
                    break
        return urls
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.warning("Could not list registered EDC assets for DCAT filter: %s", e)
        return set()
