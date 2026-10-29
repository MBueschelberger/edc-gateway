#!/bin/bash
set -eo pipefail

echo "=========================================="
echo "Uploading asset to CKAN"
echo "Title:    ${ASSET_TITLE}"
echo "CKAN URL: ${CKAN_URL}"
echo "File:     ${ASSET_FILE}"
echo "=========================================="

ckan integrate | tee /tmp/ckan_output.txt

python3 /scripts/ckan-query-urls.py

echo "=========================================="
echo "Upload completed!"
echo "Dataset:  $(cat /tmp/ckan_dataset_url.txt)"
echo "Resource: $(cat /tmp/ckan_resource_url.txt)"
echo "=========================================="
