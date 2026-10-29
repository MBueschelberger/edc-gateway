"""
02 — Update an existing role (admin operation).

Replaces the name, description, and permissions of the role identified by ROLE_ID.

Permission model: each permission is an object with three fields:
  scope     — "edc" or "user"
  instance  — "*" (wildcard) or a specific EDC ID; "user" scope only allows "*"
  operation — depends on scope:
                edc:  manage | consume | create_asset | catalog | status | bpn-discovery | inspect
                user: manage

Run:
  python 02_manage_roles.py --role-id <uuid>
"""

import argparse

from _client import GATEWAY_URL, get_token, make_session, pp

parser = argparse.ArgumentParser(
    description="Update an existing role via the EDC Gateway admin API"
)
parser.add_argument("--role-id", required=True, help="UUID of the role to update")
args = parser.parse_args()

TOKEN = get_token()

role = {
    "name": "admin",
    "description": "Full access to all EDCs and user management",
    "permissions": [
        {"scope": "edc", "instance": "*", "operation": "manage"},
        {"scope": "edc", "instance": "*", "operation": "consume"},
        {"scope": "edc", "instance": "*", "operation": "create_asset"},
        {"scope": "edc", "instance": "*", "operation": "catalog"},
        {"scope": "edc", "instance": "*", "operation": "status"},
        {"scope": "edc", "instance": "*", "operation": "inspect"},
        {"scope": "edc", "instance": "*", "operation": "bpn-discovery"},
        {"scope": "user", "instance": "*", "operation": "manage"},
    ],
}

with make_session(TOKEN) as s:
    resp = s.put(f"{GATEWAY_URL}/api/admin/roles/{args.role_id}", json=role)
    resp.raise_for_status()
    pp(f"Updated role {args.role_id}", resp.json())
