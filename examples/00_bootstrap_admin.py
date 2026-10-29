"""
00 — Bootstrap first admin user.

Calls POST /admin/bootstrap with the token of the currently logged-in user.
The endpoint is only active when no user with `users:*:manage` exists yet.
After the first successful call it permanently returns 409.

Run:
  python 00_bootstrap_admin.py
"""

import sys

from _client import GATEWAY_URL, get_token, make_session, pp

TOKEN = get_token()

with make_session(TOKEN) as s:
    print(TOKEN)
    resp = s.post(f"{GATEWAY_URL}/api/admin/bootstrap")

if resp.status_code == 409:
    print("Bootstrap already completed — an admin already exists.")
    sys.exit(0)

resp.raise_for_status()
pp(
    "Admin bootstrapped — user now has role 'admin' with scope=user instance=* operation=manage",
    resp.json(),
)
