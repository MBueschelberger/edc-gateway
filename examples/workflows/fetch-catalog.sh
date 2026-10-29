#!/bin/bash

source .env.consume

# Build cert options if CLIENT_CERT_PATH is set
if [ -n "${CLIENT_CERT_PATH}" ]; then
  CURL_CERT_OPTS="--cert-type P12 --cert ${CLIENT_CERT_PATH}:${CLIENT_CERT_PASSWORD}"
else
  CURL_CERT_OPTS=""
fi

USE_2025_1=false


while [[ "$#" -gt 0 ]]; do
    case $1 in
        --use-2025-1) USE_2025_1=true ;;
        *)
    esac
    shift
done

# Set protocol and DSP path based on --use-2025-1 flag
if [ "$USE_2025_1" = true ]; then
  DSP_PATH_SUFFIX="/2025-1"
  DSP_PROTOCOL="dataspace-protocol-http:2025-1"
else
  DSP_PATH_SUFFIX=""
  DSP_PROTOCOL="dataspace-protocol-http"
fi

echo "=========================================="
echo "Protocol: ${DSP_PROTOCOL}"
echo "Consumer URl: ${CONSUMER_URL}"
echo "Cert Path: ${CLIENT_CERT_PATH}"
echo "Provider DID: ${PROVIDER_DID}"
echo "Provider DSP URL: ${PROVIDER_DSP_URL}"
echo "=========================================="


curl -s -X 'POST' \
  "${CONSUMER_URL}/management/v3/catalog/request" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${CONSUMER_API_KEY}" \
  ${CURL_CERT_OPTS} \
  -d "{
  \"@context\": [{
    \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\"
  }],
  \"@type\": \"CatalogRequest\",
  \"counterPartyId\": \"${PROVIDER_DID}\",
  \"counterPartyAddress\": \"${PROVIDER_DSP_URL}${DSP_PATH_SUFFIX}\",
  \"protocol\": \"${DSP_PROTOCOL}\",
  \"querySpec\": {
    \"offset\": 0,
    \"limit\": 50
  }
}" | jq .


