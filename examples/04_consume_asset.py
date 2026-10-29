"""
04 — Consume an asset via the EDC Gateway.

Flow:
  1. POST /edcs/{id}/consume  →  Argo workflow submitted, job_id returned (202)
  2. GET  /jobs/{id}          →  polled every POLL_INTERVAL seconds until succeeded/failed
  3. GET  /jobs/{id}/artifacts/asset-data  →  artifact saved to disk on success

Run:
  python 04_consume_asset.py <asset_id>

Example:
  python 04_consume_asset.py urn:uuid:12345678-1234-1234-1234-123456789abc

Required env vars:
  EDC_ID            — registered EDC identifier
  PROVIDER_BPN      — provider BPN (optional override)
  PROVIDER_DSP_URL  — provider DSP endpoint (optional override)
"""

import os
import sys
import time

from _client import GATEWAY_URL, get_token, make_session, pp

if len(sys.argv) < 2:
    print("Usage: python 04_consume_asset.py <asset_id>")
    sys.exit(1)

ASSET_ID = sys.argv[1]
EDC_ID = os.environ["EDC_ID"]
TOKEN = get_token()

PROVIDER_BPN = os.getenv("PROVIDER_BPN")
PROVIDER_DSP_URL = os.getenv("PROVIDER_DSP_URL")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))

# ── Submit consume workflow ───────────────────────────────────────────────────

consume_request = {
    "asset_id": ASSET_ID,
    # "use_edrs": True,
    "add_membership": False,
    "debug": True,
}

if PROVIDER_BPN:
    consume_request["provider_bpn"] = PROVIDER_BPN
if PROVIDER_DSP_URL:
    consume_request["provider_dsp_url"] = PROVIDER_DSP_URL

print(f"\n  Submitting consume-asset workflow for: {ASSET_ID}")
with make_session(TOKEN) as s:
    resp = s.post(f"{GATEWAY_URL}/api/edcs/{EDC_ID}/consume", json=consume_request)
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

pp("Job succeeded", job)

# ── Download artifact ─────────────────────────────────────────────────────────

artifacts = (job.get("outputs") or {}).get("artifacts") or []
artifact_name = next((a["name"] for a in artifacts), "asset-data")

print("\n  Inspecting logs:")
with make_session(TOKEN) as s:
    resp = s.get(f"{GATEWAY_URL}/api/jobs/{job_id}/logs", params={"edc_id": EDC_ID})
    resp.raise_for_status()
    text = "\n".join(resp.json())
    print(text)

print(f"\n  Downloading artifact: {artifact_name}")
with make_session(TOKEN) as s:
    resp = s.get(
        f"{GATEWAY_URL}/api/jobs/{job_id}/artifacts/{artifact_name}", params={"edc_id": EDC_ID}
    )
    resp.raise_for_status()

content_type = resp.headers.get("content-type", "application/octet-stream")
ext = content_type.split("/")[-1].split(";")[0].strip()
out_file = f"{artifact_name}.{ext}" if ext and ext != "octet-stream" else artifact_name

with open(out_file, "wb") as f:
    f.write(resp.content)

print(f"  Saved {len(resp.content)} bytes → {out_file}")
