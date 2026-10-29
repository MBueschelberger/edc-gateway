"""
05 — Create and publish an asset via the EDC Gateway.

Flow:
  1. POST /edcs/{id}/assets  →  Argo workflow submitted (202)
  2. GET  /jobs/{id}/stream  →  SSE stream shows progress:
       [status]  Argo phase updates
       [done]    all 5 steps completed (upload + register + 2 policies + contract def)
       [failed]  one step failed

The Argo workflow runs create-asset.sh which handles:
  - Step 1: Upload asset to submodel server (or use HTTPS URL directly)
  - Step 2: Register asset in EDC
  - Step 3: Create usage policy
  - Step 4: Create access policy (BPN-restricted)
  - Step 5: Create contract definition

OAuth2 DataAddress: if the EDC was registered with oauth2_token_url set,
the data address will be built with OAuth2 credentials automatically.

Run:
  python 05_create_asset.py

Required env vars:
  EDC_ID              — registered EDC identifier
  ASSET_NAME          — human-readable asset name
  ASSET_PATH          — HTTPS URL or filesystem path inside the Argo pod
  CONSUMER_BPN        — BPN of the permitted consumer

Optional env vars:
  ASSET_DESCRIPTION   — asset description (default: empty)
  ASSET_TYPE          — MIME type (default: application/json)
  FULL_POLICY         — true → adds Membership + FrameworkAgreement constraints (default: false)
  DATA_ADDRESS_BASE_URL — base URL for OAuth2 data address (Option C)
  DATA_ADDRESS_NAME     — name for OAuth2 data address (Option C)
"""

import os
import sys
import time

from _client import GATEWAY_URL, get_token, make_session, pp

EDC_ID = os.environ["EDC_ID"]
ASSET_NAME = os.environ["ASSET_NAME"]
ASSET_PATH = os.environ["ASSET_PATH"]
CONSUMER_BPN = os.environ["CONSUMER_BPN"]

ASSET_DESCRIPTION = os.getenv("ASSET_DESCRIPTION", "")
ASSET_TYPE = os.getenv("ASSET_TYPE", "application/json")
FULL_POLICY = os.getenv("FULL_POLICY", "false").lower() == "true"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

DATA_ADDRESS_BASE_URL = os.getenv("DATA_ADDRESS_BASE_URL")
DATA_ADDRESS_NAME = os.getenv("DATA_ADDRESS_NAME")

TOKEN = get_token()

# ── Build asset request ───────────────────────────────────────────────────────

asset_request = {
    "asset_name": ASSET_NAME,
    "asset_description": ASSET_DESCRIPTION,
    "asset_type": ASSET_TYPE,
    "asset_path": ASSET_PATH,
    "consumer_bpn": CONSUMER_BPN,
    "full_policy": FULL_POLICY,
}

if DATA_ADDRESS_BASE_URL:
    asset_request["data_address_base_url"] = DATA_ADDRESS_BASE_URL
if DATA_ADDRESS_NAME:
    asset_request["data_address_name"] = DATA_ADDRESS_NAME

print(f"\n  Creating asset on EDC: {EDC_ID}")
print(f"  Asset:       {ASSET_NAME}")
print(f"  Path:        {ASSET_PATH}")
print(f"  Consumer:    {CONSUMER_BPN}")
print(f"  Policy mode: {'Full Catena-X' if FULL_POLICY else 'Simplified (BPN only)'}")

with make_session(TOKEN) as s:
    resp = s.post(f"{GATEWAY_URL}/api/edcs/{EDC_ID}/assets", json=asset_request)
    resp.raise_for_status()
    job = resp.json()

pp("Job created (202 Accepted)", job)
job_id = job["id"]

# ── Poll until terminal status ────────────────────────────────────────────────

print(f"\n  Polling job {job_id} every {POLL_INTERVAL}s...")
while True:
    with make_session(TOKEN) as s:
        resp = s.get(f"{GATEWAY_URL}/api/jobs/{job_id}", params={"edc_id": EDC_ID})
        resp.raise_for_status()
        job = resp.json()

    status = job.get("status")
    phase = job.get("phase", "")
    progress = job.get("progress", "")
    print(f"  [{status}] phase={phase} progress={progress}")

    if status == "succeeded":
        break
    if status in ("failed", "error"):
        pp("Job failed", job)
        sys.exit(1)

    time.sleep(POLL_INTERVAL)

# ── Final job record ──────────────────────────────────────────────────────────

with make_session(TOKEN) as s:
    resp = s.get(f"{GATEWAY_URL}/api/jobs/{job_id}", params={"edc_id": EDC_ID})
    resp.raise_for_status()
    pp("Final job record", resp.json())
