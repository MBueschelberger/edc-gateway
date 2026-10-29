"""
Shared HTTP client for EDC Gateway examples.

Copy .env.example to examples/.env and fill in your values.
"""

import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

GATEWAY_URL = os.environ["GATEWAY_URL"].rstrip("/")
KEYCLOAK_TOKEN_URL = os.environ["KEYCLOAK_TOKEN_URL"]
KEYCLOAK_CLIENT_ID = os.environ["KEYCLOAK_CLIENT_ID"]
KEYCLOAK_CLIENT_SECRET = os.environ.get("KEYCLOAK_CLIENT_SECRET", "")
KEYCLOAK_USERNAME = os.environ.get("KEYCLOAK_USERNAME", "")
KEYCLOAK_PASSWORD = os.environ.get("KEYCLOAK_PASSWORD", "")

_ssl_raw = os.environ.get("SSL_VERIFY", "true")
SSL_VERIFY = (
    False if _ssl_raw.lower() == "false" else (_ssl_raw if _ssl_raw.lower() != "true" else True)
)


def get_token() -> str:
    """Fetch an OAuth2 access token from Keycloak."""
    if KEYCLOAK_USERNAME and KEYCLOAK_PASSWORD:
        data = {
            "grant_type": "password",
            "client_id": KEYCLOAK_CLIENT_ID,
            "client_secret": KEYCLOAK_CLIENT_SECRET,
            "username": KEYCLOAK_USERNAME,
            "password": KEYCLOAK_PASSWORD,
        }
    else:
        data = {
            "grant_type": "client_credentials",
            "client_id": KEYCLOAK_CLIENT_ID,
            "client_secret": KEYCLOAK_CLIENT_SECRET,
        }
    resp = requests.post(KEYCLOAK_TOKEN_URL, data=data, timeout=10, verify=SSL_VERIFY)
    resp.raise_for_status()
    return resp.json()["access_token"]


def make_session(token: str) -> requests.Session:
    """Return a requests.Session pre-configured with Bearer auth."""
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    s.verify = SSL_VERIFY
    return s


def pp(label: str, data) -> None:
    """Pretty-print a labeled JSON payload."""
    print(f"\n{'─'*60}")
    print(f"  {label}")
    print(f"{'─'*60}")
    print(json.dumps(data, indent=2, default=str))
