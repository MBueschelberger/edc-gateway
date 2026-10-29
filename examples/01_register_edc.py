"""
01 — Register an EDC with the gateway (admin operation).

This writes:
  - Non-sensitive config  →  PostgreSQL
  - API keys + OAuth2 creds  →  K8s Secret "edc-{id}-credentials"

Run:
  python 01_register_edc.py
"""

import os

from _client import GATEWAY_URL, get_token, make_session, pp

TOKEN = get_token()

# ── Register EDC ──────────────────────────────────────────────────────────────

edc_payload = {
    "id": os.environ["EDC_ID"],
    "display_name": os.environ["EDC_DISPLAY_NAME"],
    "consumer_url": os.environ["EDC_CONSUMER_URL"],
    "provider_url": os.environ["EDC_PROVIDER_URL"],
    "base_did": os.environ.get("EDC_BASE_DID"),
    "provider_bpn": os.environ["EDC_PROVIDER_BPN"],
    "use_2025_1": os.environ.get("EDC_USE_2025_1", "true").lower() == "true",
    "use_edrs": os.environ.get("EDC_USE_EDRS", "true").lower() == "true",
    "use_bpn": os.environ.get("EDC_USE_BPN", "false").lower() == "true",
    "contract_negotiation_router": os.environ.get("EDC_CONTRACT_NEGOTIATION_ROUTER", "edrs"),
    **(
        {
            "bpn_discovery_auth_url": os.environ["EDC_BPN_DISCOVERY_AUTH_URL"],
            "bpn_discovery_host": os.environ["EDC_BPN_DISCOVERY_HOST"],
            "bpn_discovery_endpoint": os.environ["EDC_BPN_DISCOVERY_ENDPOINT"],
        }
        if os.environ.get("EDC_BPN_DISCOVERY_AUTH_URL")
        else {}
    ),
    "secrets": {
        "consumer_api_key": os.environ["EDC_CONSUMER_API_KEY"],
        "provider_api_key": os.environ["EDC_PROVIDER_API_KEY"],
        **(
            {
                "oauth2_token_url": os.environ["EDC_OAUTH2_TOKEN_URL"],
                "oauth2_client_id": os.environ["EDC_OAUTH2_CLIENT_ID"],
                "oauth2_client_secret_key": os.environ["EDC_OAUTH2_CLIENT_SECRET_KEY"],
                "oauth2_grant_type": os.environ.get("EDC_OAUTH2_GRANT_TYPE", "client_credentials"),
            }
            if os.environ.get("EDC_OAUTH2_TOKEN_URL")
            else {}
        ),
        **(
            {
                "client_cert_path": os.environ["EDC_CLIENT_CERT_PATH"],
                "client_cert_password": os.environ["EDC_CLIENT_CERT_PASSWORD"],
            }
            if os.environ.get("EDC_CLIENT_CERT_PATH")
            else {}
        ),
        **(
            {
                "bpn_discovery_client_id": os.environ["EDC_BPN_DISCOVERY_CLIENT_ID"],
                "bpn_discovery_client_secret": os.environ["EDC_BPN_DISCOVERY_CLIENT_SECRET"],
            }
            if os.environ.get("EDC_BPN_DISCOVERY_AUTH_URL")
            else {}
        ),
    },
}

with make_session(TOKEN) as s:
    resp = s.post(f"{GATEWAY_URL}/api/admin/edcs", json=edc_payload)
    resp.raise_for_status()
    pp("Registered EDC", resp.json())

# ── List all EDCs ─────────────────────────────────────────────────────────────

with make_session(TOKEN) as s:
    resp = s.get(f"{GATEWAY_URL}/api/admin/edcs")
    resp.raise_for_status()
    pp("All registered EDCs", resp.json())

# ── Rotate secrets (PATCH) ────────────────────────────────────────────────────

# print("\n  Rotating API key...")
# with make_session(TOKEN) as s:
#     resp = s.patch(f"{GATEWAY_URL}/api/admin/edcs/{os.environ['EDC_ID']}", json={
#         "secrets": {
#             "consumer_api_key": os.environ["EDC_CONSUMER_API_KEY"],
#             "provider_api_key": os.environ["EDC_PROVIDER_API_KEY"],
#         }
#     })
#     resp.raise_for_status()
#     pp("Updated EDC", resp.json())
