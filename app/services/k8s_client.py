"""Kubernetes secret management for EDC credential storage."""

import base64

from kubernetes import client as k8s
from kubernetes import config as k8s_config
from kubernetes.client.exceptions import ApiException

from app.config.settings import settings

_state: dict[str, k8s.CoreV1Api | None] = {"api": None}


def _core() -> k8s.CoreV1Api:
    """Return the cached CoreV1Api instance, initializing on first call."""
    if _state["api"] is None:
        if settings.k8s_in_cluster:
            k8s_config.load_incluster_config()
        else:
            k8s_config.load_kube_config()
        _state["api"] = k8s.CoreV1Api()
    return _state["api"]


def create_or_update_secret(name: str, data: dict[str, str]) -> None:
    """Create or replace a namespaced K8s secret with the given string data."""
    api = _core()
    secret = k8s.V1Secret(
        metadata=k8s.V1ObjectMeta(
            name=name,
            namespace=settings.k8s_namespace,
            labels={"app.kubernetes.io/managed-by": "edc-gateway"},
        ),
        string_data={k: v for k, v in data.items() if v},
    )
    try:
        api.read_namespaced_secret(name, settings.k8s_namespace)
        api.replace_namespaced_secret(name, settings.k8s_namespace, secret)
    except ApiException as exc:
        if exc.status == 404:
            api.create_namespaced_secret(settings.k8s_namespace, secret)
        else:
            raise


def delete_secret(name: str) -> None:
    """Delete a namespaced K8s secret, ignoring 404."""
    try:
        _core().delete_namespaced_secret(name, settings.k8s_namespace)
    except ApiException as exc:
        if exc.status != 404:
            raise


def read_secret(name: str) -> dict[str, str]:
    """Read and base64-decode all keys from a namespaced K8s secret."""
    secret = _core().read_namespaced_secret(name, settings.k8s_namespace)
    if not secret.data:
        return {}
    return {k: base64.b64decode(v).decode() for k, v in secret.data.items()}


def get_bearer_token() -> str:
    """Return the raw bearer token from the active kubernetes client configuration."""
    _core()  # ensure config is loaded
    cfg = k8s.Configuration.get_default_copy()
    return cfg.auth_settings().get("BearerToken", {}).get("value")


def edc_secret_name(edc_id: str) -> str:
    """Return the K8s secret name for a given EDC ID."""
    return f"edc-{edc_id}-credentials"
