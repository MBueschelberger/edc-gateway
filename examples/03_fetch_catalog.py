"""
03 — Fetch the provider catalog from a registered EDC (direct, synchronous).

Options:
  - Full catalog (no asset_id filter)
  - Filter by specific asset ID
  - Override provider DID / DSP URL per request (useful for ad-hoc queries)

Run:
  python 03_fetch_catalog.py

Required env vars:
  EDC_ID            — registered EDC identifier
  PROVIDER_DSP_URL  — provider DSP endpoint for ad-hoc query (optional)
  PROVIDER_BPN      — provider BPN for ad-hoc query (optional)
"""

import os

from _client import GATEWAY_URL, get_token, make_session, pp

TOKEN = get_token()
EDC_ID = os.environ["EDC_ID"]

PROVIDER_DSP_URL = os.getenv("PROVIDER_DSP_URL")
PROVIDER_BPN = os.getenv("PROVIDER_BPN")

# ── Full catalog ──────────────────────────────────────────────────────────────

print(f"\n  Fetching own catalog from EDC: {EDC_ID}")
with make_session(TOKEN) as s:
    resp = s.post(f"{GATEWAY_URL}/api/edcs/{EDC_ID}/catalog")
    resp.raise_for_status()
    catalog = resp.json()

datasets = catalog.get("dataset") or catalog.get("dcat:dataset") or []
if isinstance(datasets, dict):
    datasets = [datasets]

print(f"\n  Found {len(datasets)} dataset(s) in catalog")
pp("Catalog response", catalog)

# # ── Filter by asset ID ────────────────────────────────────────────────────────

# asset_id = sys.argv[1] if len(sys.argv) > 1 else None

# if asset_id:
#     print(f"\n  Filtering catalog for asset: {asset_id}")
#     with make_session(TOKEN) as s:
#         resp = s.post(
#             f"{GATEWAY_URL}/api/edcs/{EDC_ID}/catalog",
#             params={"asset_id": asset_id},
#         )
#         resp.raise_for_status()
#         pp(f"Catalog filtered for {asset_id}", resp.json())

# # ── Override provider address (ad-hoc query to a different provider) ──────────

if PROVIDER_DSP_URL and PROVIDER_BPN:
    print("\n  Ad-hoc catalog query to a different provider address...")
    with make_session(TOKEN) as s:
        resp = s.post(
            f"{GATEWAY_URL}/api/edcs/{EDC_ID}/catalog",
            params={
                "provider_dsp_url": PROVIDER_DSP_URL,
                "provider_bpn": PROVIDER_BPN,
            },
        )
        if resp.status_code == 200:
            pp("Ad-hoc catalog response", resp.json())
        else:
            print(f"  Status {resp.status_code}: {resp.text}")
else:
    print("\n  Skipping ad-hoc query (PROVIDER_DSP_URL / PROVIDER_BPN not set)")
