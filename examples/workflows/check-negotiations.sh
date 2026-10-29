#!/bin/bash

source .env.consume

# Build cert options if CLIENT_CERT_PATH is set
if [ -n "${CLIENT_CERT_PATH}" ]; then
  CURL_CERT_OPTS="--cert-type P12 --cert ${CLIENT_CERT_PATH}:${CLIENT_CERT_PASSWORD}"
else
  CURL_CERT_OPTS=""
fi

NEGOTIATION_ID=""


if [ -z "$NEGOTIATION_ID" ]; then
    NEGOTIATION_ID="$1"
else
    echo "Unknown parameter: $1"
    exit 1
fi


# Check if NEGOTIATION_ID is provided
if [ -z "$NEGOTIATION_ID" ]; then
  echo "Usage: $0 <NEGOTIATION_ID>"
  echo "Example: $0 urn:uuid:12345678-1234-1234-1234-123456789abc"
  exit 1
fi

echo "Checking consumer contract negotiations..."


echo "=========================================="
echo "Consuming Asset: ${NEGOTIATION_ID}"
echo "=========================================="


curl -s -X 'GET' \
    "${CONSUMER_URL}/management/v3/contractnegotiations/${NEGOTIATION_ID}" \
    -H 'accept: application/json' \
    -H "x-api-key: ${CONSUMER_API_KEY}" \
    ${CURL_CERT_OPTS} | jq .


curl -s -X 'POST' \
  "${CONSUMER_URL}/management/v3/contractnegotiations/request"\
  -H 'accept: application/json'  \
  -H "x-api-key: ${CONSUMER_API_KEY}"  \
  -H "Content-Type: application/json" \
  -d "{ 
    \"@context\": [
    \"https://w3id.org/edc/connector/management/v0.0.1\"
    ],
    \"@type\": \"QuerySpec\",
    \"limit\": 100,
    \"offset\": 0,
    \"filterExpression\": [

    ]
  }" | jq .
