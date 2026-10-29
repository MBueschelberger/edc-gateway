"""HTTP response helpers shared across service clients."""

import json

import httpx


def _resp_body(resp: httpx.Response) -> str:
    """Return the response body as pretty-printed JSON, falling back to raw text."""
    try:
        return json.dumps(resp.json(), indent=2)
    except Exception:  # pylint: disable=broad-exception-caught
        return resp.text
