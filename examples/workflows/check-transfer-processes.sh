#!/bin/bash

source .env.consume

TRANSFER_PROCESS_ID="$1"

# Build cert options if CLIENT_CERT_PATH is set
if [ -n "${CLIENT_CERT_PATH}" ]; then
  CURL_CERT_OPTS="--cert-type P12 --cert ${CLIENT_CERT_PATH}:${CLIENT_CERT_PASSWORD}"
else
  CURL_CERT_OPTS=""
fi

if [ -n "$TRANSFER_PROCESS_ID" ]; then
  FILTER_EXPRESSION='[
      {
        "operandLeft": "id",
        "operator": "=",
        "operandRight": "'"${TRANSFER_PROCESS_ID}"'"
      }
    ]'
else
  FILTER_EXPRESSION='[]'
fi

echo "=== Transfer Processes ==="
curl -s -X 'POST' \
    "${CONSUMER_URL}/management/v3/transferprocesses/request" \
    -H 'accept: application/json' \
    -H 'Content-Type: application/json' \
    -H "x-api-key: ${CONSUMER_API_KEY}" \
    ${CURL_CERT_OPTS} \
    -d "{
    \"@context\": {
      \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\"
    },
    \"@type\": \"QuerySpec\",
    \"filterExpression\": ${FILTER_EXPRESSION}
  }" | jq .

if [ -n "$TRANSFER_PROCESS_ID" ]; then
  echo ""
  echo "=== Transfer Process State ==="
  curl -s -X 'GET' \
      "${CONSUMER_URL}/management/v3/transferprocesses/${TRANSFER_PROCESS_ID}/state" \
      -H 'accept: application/json' \
      -H "x-api-key: ${CONSUMER_API_KEY}" \
      ${CURL_CERT_OPTS} | jq .
fi
