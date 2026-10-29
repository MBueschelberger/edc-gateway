#!/usr/bin/env python3
"""Parse ckan_cli output and extract dataset/resource URLs to files."""
import os
import re

ckan_url = os.environ["CKAN_URL"].rstrip("/")

with open("/tmp/ckan_output.txt", encoding="utf-8") as f:  # nosec B108
    output = f.read()

match = re.search(r"^Created dataset (.+)$", output, re.MULTILINE)
if not match:
    raise RuntimeError("Could not find 'Created dataset' in ckan integrate output")
dataset_name = match.group(1).strip()
dataset_url = f"{ckan_url}/dataset/{dataset_name}"

url_matches = re.findall(r'"url":\s*"(https?://[^"]+/resource/[^"]+)"', output)
resource_url = url_matches[-1] if url_matches else ""

print(f"Dataset URL:  {dataset_url}")
print(f"Resource URL: {resource_url}")

with open("/tmp/ckan_dataset_url.txt", "w", encoding="utf-8") as f:  # nosec B108
    f.write(dataset_url)
with open("/tmp/ckan_resource_url.txt", "w", encoding="utf-8") as f:  # nosec B108
    f.write(resource_url)
