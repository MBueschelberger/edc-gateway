source .env.consume

CONTRACT_NEGOTIATION_ID="$1"

# Build cert options if CLIENT_CERT_PATH is set
if [ -n "${CLIENT_CERT_PATH}" ]; then
  CURL_CERT_OPTS="--cert-type P12 --cert ${CLIENT_CERT_PATH}:${CLIENT_CERT_PASSWORD}"
else
  CURL_CERT_OPTS=""
fi

if [ -n "$CONTRACT_NEGOTIATION_ID" ]; then
  FILTER_EXPRESSION='[
      {
        "operandLeft": "contractNegotiationId",
        "operator": "=",
        "operandRight": "'"${CONTRACT_NEGOTIATION_ID}"'"
      }
    ]'
else
  FILTER_EXPRESSION='[]'
fi

curl -s -X 'POST' \
    "${CONSUMER_URL}/management/v3/edrs/request" \
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
