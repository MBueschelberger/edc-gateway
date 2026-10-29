#!/bin/bash

source .env.create

# Build cert options if CLIENT_CERT_PATH is set
if [ -n "${CLIENT_CERT_PATH}" ]; then
  CURL_CERT_OPTS="--cert-type P12 --cert ${CLIENT_CERT_PATH}:${CLIENT_CERT_PASSWORD}"
else
  CURL_CERT_OPTS=""
fi

# Check if UUID is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <UUID>"
  echo "Example: $0 12345678-1234-1234-1234-123456789abc"
  exit 1
fi

UUID=$1
SID="urn:uuid:${UUID}"
USAGE_POLICY_ID="usage-policy-${UUID}"
ACCESS_POLICY_ID="access-policy-${UUID}"
CONTRACT_DEFINITION_ID="contract-def-${UUID}"

echo "=========================================="
echo "Fetching Resources for UUID: ${UUID}"
echo "=========================================="

# Fetch Asset
echo -e "\n[1/4] Fetching Asset: ${SID}"
echo "----------------------------------------"
curl -s -X 'GET' \
  "${PROVIDER_URL}/management/v3/assets/${SID}" \
  -H 'accept: application/json' \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  ${CURL_CERT_OPTS} | jq '.'

# Fetch Usage Policy
echo -e "\n[2/4] Fetching Usage Policy: ${USAGE_POLICY_ID}"
echo "----------------------------------------"
curl -s -X 'GET' \
  "${PROVIDER_URL}/management/v3/policydefinitions/${USAGE_POLICY_ID}" \
  -H 'accept: application/json' \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  ${CURL_CERT_OPTS} | jq '.'

# Fetch Access Policy
echo -e "\n[3/4] Fetching Access Policy: ${ACCESS_POLICY_ID}"
echo "----------------------------------------"
curl -s -X 'GET' \
  "${PROVIDER_URL}/management/v3/policydefinitions/${ACCESS_POLICY_ID}" \
  -H 'accept: application/json' \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  ${CURL_CERT_OPTS} | jq '.'

# Fetch Contract Definition
echo -e "\n[4/4] Fetching Contract Definition: ${CONTRACT_DEFINITION_ID}"
echo "----------------------------------------"
curl -s -X 'GET' \
  "${PROVIDER_URL}/management/v3/contractdefinitions/${CONTRACT_DEFINITION_ID}" \
  -H 'accept: application/json' \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  ${CURL_CERT_OPTS} | jq '.'

echo -e "\n=========================================="
echo "Fetch completed!"
echo "=========================================="