"""Argo Workflows client for submitting, monitoring, and fetching logs and artifacts."""

import json
import logging
from datetime import datetime
from enum import Enum
from typing import Any
from urllib.parse import urljoin

import httpx
from hera.shared import global_config
from hera.workflows.async_service import AsyncWorkflowsService
from hera.workflows.models import SubmitOpts, WorkflowSubmitRequest

from app.config.settings import settings
from app.services.http_utils import _resp_body
from app.services.k8s_client import get_bearer_token

logger = logging.getLogger(__name__)

global_config.host = settings.argo_server_url
global_config.namespace = settings.argo_namespace
global_config.token = get_bearer_token()
global_config.verify_ssl = settings.argo_verify_ssl


class ArgoPhase(str, Enum):
    """Argo workflow phase mapped to gateway-facing status strings."""

    PENDING = "Pending"
    RUNNING = "Running"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"
    ERROR = "Error"

    @property
    def gateway_status(self) -> str:
        """Return the lowercase status string exposed by the gateway API."""
        if self is ArgoPhase.ERROR:
            return "failed"
        return self.value.lower()

    @property
    def is_terminal(self) -> bool:
        """Return True if the phase represents a finished workflow."""
        return self in (ArgoPhase.SUCCEEDED, ArgoPhase.FAILED, ArgoPhase.ERROR)

    @classmethod
    def parse(cls, value: str) -> "ArgoPhase":
        """Parse a raw phase string, defaulting to RUNNING for unknown values."""
        try:
            return cls(value)
        except ValueError:
            return cls.RUNNING


async def submit_workflow(template_name: str, parameters: dict[str, str], job_id: str) -> str:
    """Submit a WorkflowTemplate and return the created workflow name."""
    req = WorkflowSubmitRequest(
        namespace=settings.argo_namespace,
        resource_kind="WorkflowTemplate",
        resource_name=template_name,
        submit_options=SubmitOpts(
            name=f"edc-gw-{job_id[:8]}",
            parameters=[f"{k}={v}" for k, v in parameters.items()],
            service_account=settings.argo_workflow_sa,
        ),
    )
    async with AsyncWorkflowsService() as svc:
        wf = await svc.submit_workflow(req)
    return wf.metadata.name


async def get_workflow_phase(workflow_name: str) -> ArgoPhase:
    """Return the current phase of the given Argo workflow."""
    async with AsyncWorkflowsService() as svc:
        wf = await svc.get_workflow(workflow_name)
    raw = wf.status.phase if (wf.status and wf.status.phase) else None
    return ArgoPhase.parse(raw) if raw else ArgoPhase.PENDING


async def get_workflow_metadata(  # pylint: disable=too-many-locals
    workflow_name: str,
) -> dict[str, Any]:
    """Return structured status metadata fetched live from Argo, including inputs and outputs."""
    async with AsyncWorkflowsService() as svc:
        wf = await svc.get_workflow(workflow_name)
    status = wf.status
    phase = ArgoPhase.parse(status.phase) if (status and status.phase) else ArgoPhase.PENDING

    def _dt(t: Any | None) -> datetime | None:
        return t.root if t is not None else None

    inputs = None
    if wf.spec and wf.spec.arguments and wf.spec.arguments.parameters:
        inputs = {
            "parameters": [{"name": p.name, "value": p.value} for p in wf.spec.arguments.parameters]
        }

    outputs = None
    if status and status.nodes:
        params: list[dict] = []
        artifacts: list[dict] = []
        exit_code: str | None = None
        entrypoint = wf.spec.entrypoint if wf.spec else None
        seen_params: set[str] = set()
        seen_artifacts: set[str] = set()
        for node in status.nodes.values():
            if entrypoint and node.template_name != entrypoint:
                continue
            if not node.outputs:
                continue
            if node.outputs.parameters:
                for p in node.outputs.parameters:
                    if p.name not in seen_params:
                        seen_params.add(p.name)
                        params.append({"name": p.name, "value": p.value})
            if node.outputs.artifacts:
                for a in node.outputs.artifacts:
                    if a.name != "main-logs" and a.name not in seen_artifacts:
                        seen_artifacts.add(a.name)
                        artifacts.append({"name": a.name})
            if node.outputs.exit_code is not None:
                exit_code = node.outputs.exit_code
        outputs = {"parameters": params, "artifacts": artifacts, "exit_code": exit_code}

    return {
        "phase": phase,
        "status": phase.gateway_status,
        "started_at": _dt(status.started_at) if status else None,
        "finished_at": _dt(status.finished_at) if status else None,
        "progress": status.progress if status else None,
        "message": status.message if status else None,
        "inputs": inputs,
        "outputs": outputs,
    }


def _parse_log_ndjson(text: str) -> list[str]:
    lines = []
    for raw in text.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            entry = json.loads(raw)
            content = entry.get("result", {}).get("content", "")
            if content:
                lines.append(content)
        except json.JSONDecodeError:
            lines.append(raw)
    return lines


async def fetch_workflow_logs(workflow_name: str) -> list[str]:
    """Fetch logs for any workflow phase.

    Live NDJSON endpoint for running, archived artifact for all others.
    """
    async with AsyncWorkflowsService() as svc:
        wf = await svc.get_workflow(workflow_name)

    phase = (
        ArgoPhase.parse(wf.status.phase) if (wf.status and wf.status.phase) else ArgoPhase.PENDING
    )

    async with httpx.AsyncClient(
        verify=settings.argo_verify_ssl, timeout=settings.argo_timeout
    ) as client:
        if phase is ArgoPhase.RUNNING:
            resp = await client.get(
                urljoin(
                    settings.argo_server_url,
                    f"/api/v1/workflows/{settings.argo_namespace}/{workflow_name}/log",
                ),
                params={"logOptions.follow": "false"},
                headers={"Authorization": global_config.token},
            )
            resp.raise_for_status()
            return _parse_log_ndjson(resp.text)

        nodes = list((wf.status.nodes or {}).values())
        log_nodes = [
            n
            for n in nodes
            if n.outputs
            and n.outputs.artifacts
            and any(a.name == "main-logs" for a in n.outputs.artifacts)
        ]
        log_nodes.sort(key=lambda n: n.started_at.root if n.started_at else datetime.min)
        lines: list[str] = []
        for node in log_nodes:
            resp = await client.get(
                urljoin(
                    settings.argo_server_url,
                    f"/artifact-files/{settings.argo_namespace}"
                    f"/archived-workflows/{wf.metadata.uid}"
                    f"/{node.id}/outputs/main-logs",
                ),
                headers={"Authorization": global_config.token},
            )
            resp.raise_for_status()
            lines.extend(line for line in resp.text.splitlines() if line.strip())
        return lines


async def fetch_artifact_bytes(workflow_name: str, artifact_name: str) -> bytes:
    """Fetch a single named artifact from a workflow. Returns the raw content bytes."""
    async with AsyncWorkflowsService() as svc:
        wf = await svc.get_workflow(workflow_name)

    if not wf.status or not wf.status.nodes:
        raise ValueError(f"No nodes found for workflow {workflow_name}")

    for node_id, node in wf.status.nodes.items():
        if not (node.outputs and node.outputs.artifacts):
            continue
        for artifact in node.outputs.artifacts:
            if artifact.name != artifact_name:
                continue
            async with httpx.AsyncClient(
                verify=settings.argo_verify_ssl, timeout=settings.argo_timeout
            ) as client:
                resp = await client.get(
                    urljoin(
                        settings.argo_server_url,
                        f"/artifacts-by-uid/{wf.metadata.uid}/{node_id}/{artifact_name}",
                    ),
                    headers={"Authorization": global_config.token},
                )
                try:
                    resp.raise_for_status()
                except httpx.HTTPStatusError:
                    logger.error(
                        "GET artifact %s for workflow %s failed with %s\nresponse:\n%s",
                        artifact_name,
                        workflow_name,
                        resp.status_code,
                        _resp_body(resp),
                    )
                    raise
                return resp.content

    raise ValueError(f"Artifact '{artifact_name}' not found in workflow {workflow_name}")


async def get_workflow_output_parameters(workflow_name: str) -> dict[str, str]:
    """Fetch workflow-level output parameters from a completed workflow."""
    meta = await get_workflow_metadata(workflow_name)
    outputs = meta.get("outputs") or {}
    return {
        p["name"]: p["value"]
        for p in outputs.get("parameters", [])
        if p.get("name") and p.get("value") is not None
    }


async def stream_workflow_logs(workflow_name: str):
    """Async generator that yields individual log lines in real-time (Argo follow=true).

    The stream closes naturally when the workflow terminates.
    """
    async with httpx.AsyncClient(
        verify=settings.argo_verify_ssl,
        timeout=httpx.Timeout(connect=10.0, read=None, write=None, pool=None),
    ) as client:
        async with client.stream(
            "GET",
            urljoin(
                settings.argo_server_url,
                f"/api/v1/workflows/{settings.argo_namespace}/{workflow_name}/log",
            ),
            params={"logOptions.follow": "true"},
            headers={"Authorization": global_config.token},
        ) as resp:
            resp.raise_for_status()
            async for raw in resp.aiter_lines():
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    entry = json.loads(raw)
                    content = entry.get("result", {}).get("content", "")
                    if content:
                        yield content
                except json.JSONDecodeError:
                    yield raw
