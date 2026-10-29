#!/usr/bin/env python3
"""Generate a ckan_cli metadata.py file from environment variables."""
import json
import os
import shutil

title = os.environ["ASSET_TITLE"]
desc = os.environ.get("ASSET_DESCRIPTION", "")
org = os.environ["CKAN_OWNER_ORG"]
asset_file = os.environ["ASSET_FILE"]
output_filename = os.environ.get("OUTPUT_FILENAME", "").strip()

upload_dir = "/tmp/asset-upload"  # nosec B108
os.makedirs(upload_dir, exist_ok=True)

basename = os.path.basename(output_filename) if output_filename else os.path.basename(asset_file)
resource_path = os.path.join(upload_dir, basename)
shutil.copy(asset_file, resource_path)

lines = [
    "metadata = [",
    "    {",
    '        "title": ' + json.dumps(title) + ",",
    '        "notes": ' + json.dumps(desc) + ",",
    '        "owner_org": ' + json.dumps(org) + ",",
    '        "resources": [{"path": ' + json.dumps(resource_path) + "}],",
    '        "tags": [],',
    "    }",
    "]",
]
with open("/tmp/metadata.py", "w", encoding="utf-8") as f:  # nosec B108
    f.write("\n".join(lines) + "\n")
print(f"Generated /tmp/metadata.py (resource path: {resource_path})")
