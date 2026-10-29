#!/bin/bash

source .env.consume

# Build cert options if CLIENT_CERT_PATH is set
if [ -n "${CLIENT_CERT_PATH}" ]; then
  CURL_CERT_OPTS="--cert-type P12 --cert ${CLIENT_CERT_PATH}:${CLIENT_CERT_PASSWORD}"
else
  CURL_CERT_OPTS=""
fi

# Parse command line arguments
ASSET_ID="$1"

if [ -z "$ASSET_ID" ]; then
  echo "Usage: $0 <ASSET_ID>"
  echo "Example: $0 urn:uuid:12345678-1234-1234-1234-123456789abc"
  echo "Configure USE_2025_1 and USE_BPN in .env.consume"
  exit 1
fi

USE_2025_1="${USE_2025_1:-false}"
USE_BPN="${USE_BPN:-false}"
USE_EDRS="${USE_EDRS:-true}"
ADD_MEMBERSHIP_ACTIVE="${ADD_MEMBERSHIP_ACTIVE:-false}"
DEBUG="${DEBUG:-false}"

# Determine assigner value
if [ "$USE_BPN" = true ]; then
  ASSIGNER_ID="${PROVIDER_BPN}"
else
  ASSIGNER_ID="${PROVIDER_DID}"
fi

# Set protocol and DSP path based on --use-2025-1 flag
if [ "$USE_2025_1" = true ]; then
  DSP_PATH_SUFFIX="/2025-1"
  DSP_PROTOCOL="dataspace-protocol-http:2025-1"
else
  DSP_PATH_SUFFIX=""
  DSP_PROTOCOL="dataspace-protocol-http"
fi

echo "=========================================="
echo "Consuming Asset: ${ASSET_ID}"
echo "Protocol: ${DSP_PROTOCOL}"
echo "Consumer URl: ${CONSUMER_URL}"
echo "Cert Path: ${CLIENT_CERT_PATH}"
echo "Provider DID: ${PROVIDER_DID}"
echo "Provider BPN: ${PROVIDER_BPN}"
echo "Assigner ID: ${ASSIGNER_ID} ($([ "$USE_BPN" = true ] && echo "BPN" || echo "DID"))"
echo "Provider DSP URL: ${PROVIDER_DSP_URL}"
echo "Use EDRs:       ${USE_EDRS}"
echo "Add Membership: ${ADD_MEMBERSHIP_ACTIVE}"
echo "Debug:          ${DEBUG}"
echo "=========================================="

# Step 1: Fetch Provider's Catalog
echo -e "\n[1/5] Fetching provider's catalog..."
PAYLOAD="{
  \"@context\": [{
    \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\"
  }],
  \"@type\": \"CatalogRequest\",
  \"counterPartyId\": \"${PROVIDER_DID}\",
  \"counterPartyAddress\": \"${PROVIDER_DSP_URL}${DSP_PATH_SUFFIX}\",
  \"protocol\": \"${DSP_PROTOCOL}\",
  \"querySpec\": {
    \"offset\": 0,
    \"limit\": 50,
    \"filterExpression\": [
      {
        \"operandLeft\": \"id\",
        \"operator\": \"=\",
        \"operandRight\": \"${ASSET_ID}\"
      }
    ]    
  }
}"
if [ "$DEBUG" = true ]; then echo "Payload:" && echo "$PAYLOAD" | jq '.'; fi
if [ "$DEBUG" = true ]; then echo "→ POST ${CONSUMER_URL}/management/v3/catalog/request"; fi
CATALOG_RESPONSE=$(curl -s -X 'POST' \
  "${CONSUMER_URL}/management/v3/catalog/request" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${CONSUMER_API_KEY}" \
  ${CURL_CERT_OPTS} \
  -d "$PAYLOAD")
if [ "$DEBUG" = true ]; then echo "Catalog Response:" && echo "$CATALOG_RESPONSE" | jq '.'; fi

# Extract OFFER_ID from catalog for the specific asset
# Note: With 2025-1 API, structure changed from "dcat:dataset" to "dataset" and "odrl:hasPolicy" to "hasPolicy" (array)
OFFER_ID=$(echo "$CATALOG_RESPONSE" | jq -r ".dataset // .\"dcat:dataset\" | select(.\"@id\" == \"${ASSET_ID}\") | (.hasPolicy[0].\"@id\"? // .\"odrl:hasPolicy\".\"@id\"?)")

# Extract asset title and description from catalog for downstream consumers (e.g. CKAN upload)
ASSET_TITLE=$(echo "$CATALOG_RESPONSE" | jq -r --arg id "$ASSET_ID" \
  '(.dataset // .["dcat:dataset"]) | select(.["@id"] == $id) | (.name // .["dct:title"] // .["edc:name"] // $id)')
ASSET_DESCRIPTION=$(echo "$CATALOG_RESPONSE" | jq -r --arg id "$ASSET_ID" \
  '(.dataset // .["dcat:dataset"]) | select(.["@id"] == $id) | (.description // .["dct:description"] // .["edc:description"] // "") // ""')
echo "$ASSET_TITLE" > /tmp/asset_title.txt
echo "$ASSET_DESCRIPTION" > /tmp/asset_description.txt
echo "Asset Title: ${ASSET_TITLE}"
echo "Asset Description: ${ASSET_DESCRIPTION}"

if [ -z "$OFFER_ID" ] || [ "$OFFER_ID" == "null" ]; then
  echo "ERROR: Could not find offer for asset ${ASSET_ID} in catalog"
  exit 1
fi

echo -e "\nFound Offer ID: ${OFFER_ID}"

# Extract cx-policy namespace from catalog context (varies by provider: with or without 2025/9)
CX_POLICY_NS=$(echo "$CATALOG_RESPONSE" | jq -r '.["@context"]["cx-policy"] // "https://w3id.org/catenax/policy/"')
if [ "$DEBUG" = true ]; then echo "cx-policy namespace: ${CX_POLICY_NS}"; fi

# Extract policy components directly from catalog offer.
# Both branches handle compact (2025-1) and namespaced (legacy) formats because
# providers may return either format regardless of the protocol version negotiated.
if [ "$USE_2025_1" = true ]; then
  OFFER_PERMISSION=$(echo "$CATALOG_RESPONSE" | jq -c "(.dataset // .\"dcat:dataset\") | select(.\"@id\" == \"${ASSET_ID}\") | (.hasPolicy[0].permission // .\"odrl:hasPolicy\".\"odrl:permission\" // [])")
  OFFER_PROHIBITION=$(echo "$CATALOG_RESPONSE" | jq -c "(.dataset // .\"dcat:dataset\") | select(.\"@id\" == \"${ASSET_ID}\") | (.hasPolicy[0].prohibition // .\"odrl:hasPolicy\".\"odrl:prohibition\" // [])")
  OFFER_OBLIGATION=$(echo "$CATALOG_RESPONSE" | jq -c "(.dataset // .\"dcat:dataset\") | select(.\"@id\" == \"${ASSET_ID}\") | (.hasPolicy[0].obligation // .\"odrl:hasPolicy\".\"odrl:obligation\" // [])")
else
  OFFER_PERMISSION=$(echo "$CATALOG_RESPONSE" | jq -c ".\"dcat:dataset\" | select(.\"@id\" == \"${ASSET_ID}\") | .\"odrl:hasPolicy\".\"odrl:permission\"")
  OFFER_PROHIBITION=$(echo "$CATALOG_RESPONSE" | jq -c ".\"dcat:dataset\" | select(.\"@id\" == \"${ASSET_ID}\") | .\"odrl:hasPolicy\".\"odrl:prohibition\" // []")
  OFFER_OBLIGATION=$(echo "$CATALOG_RESPONSE" | jq -c ".\"dcat:dataset\" | select(.\"@id\" == \"${ASSET_ID}\") | .\"odrl:hasPolicy\".\"odrl:obligation\" // []")
fi

# Expand cx-policy: compact IRIs to full URIs in permission.
# cx-policy: contains a hyphen, which is not a valid NCNAME prefix in JSON-LD 1.0.
# Many EDC connectors use a JSON-LD 1.0 processor and will NOT expand cx-policy:X
# to its full URI, leaving a null value that causes "Value in JsonObjects name/value
# pair cannot be null" during DSP message construction.
OFFER_PERMISSION=$(echo "$OFFER_PERMISSION" | jq --arg ns "$CX_POLICY_NS" '
  walk(if type == "object" and has("@id") and (.["@id"] | startswith("cx-policy:"))
  then .["@id"] |= ($ns + ltrimstr("cx-policy:"))
  else . end)')

# Normalize odrl:and: a single-object and-constraint is semantically invalid (AND requires >= 2 operands).
# Sovity providers sometimes serialize a single constraint wrapped in odrl:and as an object instead of
# an array. Unwrap it to a direct constraint so the provider's policy engine accepts it.
_normalize_and() {
  echo "$1" | jq '
    def fix:
      if (."odrl:constraint" | type) == "object" then
        if (."odrl:constraint"."odrl:and" | type) == "object" then
          .["odrl:constraint"] = ."odrl:constraint"."odrl:and"
        elif (."odrl:constraint"."odrl:and" | type) == "array" and (."odrl:constraint"."odrl:and" | length) == 1 then
          .["odrl:constraint"] = ."odrl:constraint"."odrl:and"[0]
        else . end
      else . end;
    if type == "array" then map(fix) else fix end'
}
OFFER_PERMISSION=$(  _normalize_and "$OFFER_PERMISSION")
OFFER_PROHIBITION=$( _normalize_and "$OFFER_PROHIBITION")
OFFER_OBLIGATION=$(  _normalize_and "$OFFER_OBLIGATION")


if [ "$ADD_MEMBERSHIP_ACTIVE" = true ]; then
  if [ "$USE_2025_1" = true ]; then
    MEMBERSHIP_CONSTRAINT='{"leftOperand":"Membership","operator":"eq","rightOperand":"active"}'
    OFFER_PERMISSION=$(echo "$OFFER_PERMISSION" | jq --argjson mc "$MEMBERSHIP_CONSTRAINT" '
      def add_mc(mc):
        if   (.constraint == null)               then . + {"constraint": [mc]}
        elif (.constraint | type) == "array"     then .constraint += [mc]
        else . + {"constraint": [.constraint, mc]} end;
      if type == "array" then map(add_mc($mc)) else add_mc($mc) end')
  else
    MEMBERSHIP_CONSTRAINT='{"odrl:leftOperand":{"@id":"cx-policy:Membership"},"odrl:operator":{"@id":"odrl:eq"},"odrl:rightOperand":"active"}'
    OFFER_PERMISSION=$(echo "$OFFER_PERMISSION" | jq --argjson mc "$MEMBERSHIP_CONSTRAINT" '
      def add_mc(mc):
        if   (."odrl:constraint" == null) then
          . + {"odrl:constraint": mc}
        elif (."odrl:constraint"."odrl:and" == null) then
          . + {"odrl:constraint": {"odrl:and": [."odrl:constraint", mc]}}
        elif (."odrl:constraint"."odrl:and" | type) == "array" then
          .["odrl:constraint"]["odrl:and"] += [mc]
        else
          .["odrl:constraint"]["odrl:and"] = [."odrl:constraint"."odrl:and", mc]
        end;
      if type == "array" then map(add_mc($mc)) else add_mc($mc) end')
  fi
fi


if [ "$DEBUG" = true ]; then echo "Offer permission:" && echo "$OFFER_PERMISSION" | jq '.'; fi

# Step 2: Initiate Contract Negotiation (Request EDR)
echo -e "\n[2/5] Initiating contract negotiation..."

if [ "${CONTRACT_NEGOTATION_ROUTER}" = "edrs" ]; then
  # EDRS router format: NegotiationInitiateRequestDto for /management/edrs endpoint
  PAYLOAD="{
    \"@context\": {
      \"odrl\": \"http://www.w3.org/ns/odrl/2/\"
    },
    \"@type\": \"NegotiationInitiateRequestDto\",
    \"connectorAddress\": \"${PROVIDER_DSP_URL}${DSP_PATH_SUFFIX}\",
    \"counterPartyAddress\": \"${PROVIDER_DSP_URL}${DSP_PATH_SUFFIX}\",
    \"protocol\": \"${DSP_PROTOCOL}\",
    \"connectorId\": \"${PROVIDER_BPN}\",
    \"providerId\": \"${PROVIDER_BPN}\",
    \"offer\": {
      \"offerId\": \"${OFFER_ID}\",
      \"assetId\": \"${ASSET_ID}\",
      \"policy\": {
        \"@type\": \"odrl:Set\",
        \"odrl:permission\": ${OFFER_PERMISSION},
        \"odrl:prohibition\": ${OFFER_PROHIBITION},
        \"odrl:obligation\": ${OFFER_OBLIGATION},
        \"odrl:target\": \"${ASSET_ID}\"
      }
    },
    \"policy\": {
      \"@id\": \"${OFFER_ID}\",
      \"@type\": \"odrl:Offer\",
      \"odrl:assigner\": { \"@id\": \"${ASSIGNER_ID}\" },
      \"odrl:permission\": ${OFFER_PERMISSION},
      \"odrl:prohibition\": ${OFFER_PROHIBITION},
      \"odrl:obligation\": ${OFFER_OBLIGATION},
      \"odrl:target\": { \"@id\": \"${ASSET_ID}\" }
    }
  }"
elif [ "$USE_2025_1" = true ]; then
  # 2025-1 format: compact context, simple property names, PROVIDER_DID as assigner
  PAYLOAD="{
    \"@context\": [
      \"http://www.w3.org/ns/odrl.jsonld\",
      \"https://w3id.org/catenax/2025/9/policy/context.jsonld\",
      {
        \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\"
      }
    ],
    \"@type\": \"ContractRequest\",
    \"counterPartyAddress\": \"${PROVIDER_DSP_URL}${DSP_PATH_SUFFIX}\",
    \"counterPartyId\": \"${PROVIDER_BPN}\",
    \"protocol\": \"${DSP_PROTOCOL}\",
    \"policy\": {
      \"@id\": \"${OFFER_ID}\",
      \"@type\": \"Offer\",
      \"assigner\": \"${ASSIGNER_ID}\",
      \"target\": \"${ASSET_ID}\",
      \"permission\": ${OFFER_PERMISSION},
      \"prohibition\": ${OFFER_PROHIBITION},
      \"obligation\": ${OFFER_OBLIGATION}
    },
    \"callbackAddresses\": []
  }"
else
  # Legacy format: verbose @context with edc/odrl prefixes, PROVIDER_BPN as assigner
  PAYLOAD="{
    \"@context\": {
      \"tx\": \"https://w3id.org/tractusx/v0.0.1/ns/\",
      \"tx-auth\": \"https://w3id.org/tractusx/auth/\",
      \"cx-policy\": \"${CX_POLICY_NS}\",
      \"dcat\": \"http://www.w3.org/ns/dcat#\",
      \"dct\": \"http://purl.org/dc/terms/\",
      \"odrl\": \"http://www.w3.org/ns/odrl/2/\",
      \"dspace\": \"https://w3id.org/dspace/v0.8/\",
      \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\",
      \"edc\": \"https://w3id.org/edc/v0.0.1/ns/\"
    },
    \"@type\": \"ContractRequest\",
    \"counterPartyAddress\": \"${PROVIDER_DSP_URL}${DSP_PATH_SUFFIX}\",
    \"counterPartyId\": \"${PROVIDER_BPN}\",
    \"protocol\": \"${DSP_PROTOCOL}\",
    \"policy\": {
      \"@id\": \"${OFFER_ID}\",
      \"@type\": \"odrl:Offer\",
      \"odrl:assigner\": { \"@id\": \"${ASSIGNER_ID}\" },
      \"odrl:permission\": ${OFFER_PERMISSION},
      \"odrl:prohibition\": ${OFFER_PROHIBITION},
      \"odrl:obligation\": ${OFFER_OBLIGATION},
      \"odrl:target\": { \"@id\": \"${ASSET_ID}\" }
    },
    \"callbackAddresses\": []
  }"
fi


if [ "$DEBUG" = true ]; then echo "Payload:" && echo "$PAYLOAD" | jq '.'; fi
if [ "$DEBUG" = true ]; then echo "→ POST ${CONSUMER_URL}/management/v3/${CONTRACT_NEGOTATION_ROUTER}"; fi
EDR_RESPONSE=$(curl -s -X 'POST' \
  "${CONSUMER_URL}/management/v3/${CONTRACT_NEGOTATION_ROUTER}" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${CONSUMER_API_KEY}" \
  ${CURL_CERT_OPTS} \
  -d "$PAYLOAD")
if [ "$DEBUG" = true ]; then echo "Contract negotiation response:" && echo "$EDR_RESPONSE" | jq '.'; fi

# Extract Contract Negotiation ID
CONTRACT_NEGOTIATION_ID=$(echo "$EDR_RESPONSE" | jq -r '.["@id"] // .id // empty')

if [ -z "$CONTRACT_NEGOTIATION_ID" ]; then
  echo "ERROR: Could not extract contract negotiation ID from response"
  exit 1
fi

echo -e "\nContract Negotiation ID: ${CONTRACT_NEGOTIATION_ID}"

# Wait and check negotiation status with retry
echo -e "\n[2.5/5] Waiting for contract negotiation to complete..."
MAX_RETRIES=12
RETRY_COUNT=0
NEGOTIATION_STATE=""

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  sleep 5

  if [ "$DEBUG" = true ]; then echo "→ GET ${CONSUMER_URL}/management/v3/contractnegotiations/${CONTRACT_NEGOTIATION_ID}"; fi
  CONTRACT_STATUS=$(curl -s -X 'GET' \
    "${CONSUMER_URL}/management/v3/contractnegotiations/${CONTRACT_NEGOTIATION_ID}" \
    -H 'accept: application/json' \
    -H "x-api-key: ${CONSUMER_API_KEY}" \
    ${CURL_CERT_OPTS})
  if [ "$DEBUG" = true ]; then echo "Contract negotiation status:" && echo "$CONTRACT_STATUS" | jq '.'; fi

  NEGOTIATION_STATE=$(echo "$CONTRACT_STATUS" | jq -r '.state // .["edc:state"] // empty')
  echo "Check $((RETRY_COUNT + 1))/$MAX_RETRIES - State: ${NEGOTIATION_STATE}"

  if [ "$NEGOTIATION_STATE" = "FINALIZED" ] || [ "$NEGOTIATION_STATE" = "VERIFIED" ]; then
    echo "✓ Contract negotiation completed successfully!"
    break
  elif [ "$NEGOTIATION_STATE" = "TERMINATED" ] || [ "$NEGOTIATION_STATE" = "ERROR" ]; then
    echo "ERROR: Contract negotiation failed with state: ${NEGOTIATION_STATE}"
    echo "$CONTRACT_STATUS" | jq '.'
    exit 1
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "$NEGOTIATION_STATE" != "FINALIZED" ] && [ "$NEGOTIATION_STATE" != "VERIFIED" ]; then
  echo "ERROR: Contract negotiation did not complete in time. Final state: ${NEGOTIATION_STATE}"
  echo "$CONTRACT_STATUS" | jq '.'
  exit 1
fi

CONTRACT_AGREEMENT_ID=$(echo "$CONTRACT_STATUS" | jq -r '.contractAgreementId // ."edc:contractAgreementId" // empty')
if [ -z "$CONTRACT_AGREEMENT_ID" ]; then
  echo "ERROR: Could not extract contractAgreementId from contract status"
  echo "$CONTRACT_STATUS" | jq '.'
  exit 1
fi
echo "Contract Agreement ID: ${CONTRACT_AGREEMENT_ID}"

# Step 3: Obtain transfer process ID
echo -e "\n[3/5] Obtaining transfer process ID..."
TRANSFER_PROCESS_ID=""

if [ "$USE_EDRS" = true ]; then
  MAX_EDR_RETRIES=12
  EDR_RETRY_COUNT=0

  while [ $EDR_RETRY_COUNT -lt $MAX_EDR_RETRIES ]; do
    if [ "$DEBUG" = true ]; then echo "→ POST ${CONSUMER_URL}/management/v3/edrs/request"; fi
    EDR_ENTRIES=$(curl -s -X 'POST' \
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
      \"filterExpression\": [{
        \"operandLeft\": \"agreementId\",
        \"operator\": \"=\",
        \"operandRight\": \"${CONTRACT_AGREEMENT_ID}\"
      }]
    }")
    if [ "$DEBUG" = true ]; then echo "EDR entries:" && echo "$EDR_ENTRIES" | jq '.'; fi

    TRANSFER_PROCESS_ID=$(echo "$EDR_ENTRIES" | jq -r --arg agr_id "$CONTRACT_AGREEMENT_ID" \
      '.[] | select((.agreementId // ."edc:agreementId") == $agr_id) | (.transferProcessId // ."edc:transferProcessId") // empty')

    if [ -n "$TRANSFER_PROCESS_ID" ]; then
      break
    fi

    EDR_RETRY_COUNT=$((EDR_RETRY_COUNT + 1))
    echo "EDR not yet available, waiting... ($EDR_RETRY_COUNT/$MAX_EDR_RETRIES)"
    sleep 5
  done

  if [ -z "$TRANSFER_PROCESS_ID" ]; then
    echo "$EDR_ENTRIES" | jq '.'
    echo "ERROR: Could not find transferProcessId in EDR entries for agreementId ${CONTRACT_AGREEMENT_ID}"
    exit 1
  fi
else
  PAYLOAD="{
    \"@context\": {
      \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\"
    },
    \"@type\": \"https://w3id.org/edc/v0.0.1/ns/TransferRequest\",
    \"assetId\": \"${ASSET_ID}\",
    \"counterPartyAddress\": \"${PROVIDER_DID}\",
    \"connectorId\": \"${PROVIDER_DSP_URL}${DSP_PATH_SUFFIX}\",
    \"contractId\": \"${CONTRACT_AGREEMENT_ID}\",
    \"dataDestination\": {
      \"type\": \"HttpProxy\"
    },
    \"protocol\": \"dataspace-protocol-http\",
    \"transferType\": \"HttpData-PULL\"
  }"
  if [ "$DEBUG" = true ]; then echo "Payload:" && echo "$PAYLOAD" | jq '.'; fi
  if [ "$DEBUG" = true ]; then echo "→ POST ${CONSUMER_URL}/management/v3/transferprocesses"; fi
  TP_RESPONSE=$(curl -s -X 'POST' \
    "${CONSUMER_URL}/management/v3/transferprocesses" \
    -H 'accept: application/json' \
    -H 'Content-Type: application/json' \
    -H "x-api-key: ${CONSUMER_API_KEY}" \
    ${CURL_CERT_OPTS} \
    -d "$PAYLOAD")
  if [ "$DEBUG" = true ]; then echo "Transfer process response:" && echo "$TP_RESPONSE" | jq '.'; fi

  TRANSFER_PROCESS_ID=$(echo "$TP_RESPONSE" | jq -r '.["@id"] // .id // empty')
  if [ -z "$TRANSFER_PROCESS_ID" ]; then
    echo "ERROR: Could not extract transfer process ID"
    echo "$TP_RESPONSE" | jq '.'
    exit 1
  fi

fi

echo -e "\nTransfer Process ID: ${TRANSFER_PROCESS_ID}"

if [ "$DEBUG" = true ]; then echo "→ GET ${CONSUMER_URL}/management/v3/transferprocesses/${TRANSFER_PROCESS_ID}/state"; fi
TR_STATUS_RESPONSE=$(curl -s -X 'GET' \
  "${CONSUMER_URL}/management/v3/transferprocesses/${TRANSFER_PROCESS_ID}/state" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${CONSUMER_API_KEY}" \
  ${CURL_CERT_OPTS})
if [ "$DEBUG" = true ]; then echo "Transfer process status response:" && echo "$TR_STATUS_RESPONSE" | jq '.'; fi

# Step 4: Pull out the EDR (get data address with credentials)
echo -e "\n[4/5] Pulling EDR data address..."

echo -e "\n[4.5/5] Waiting for EDRS to be ready..."
MAX_RETRIES=12
RETRY_COUNT=0
EDR_DATA_ID=""


while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  sleep 5
  if [ "$DEBUG" = true ]; then echo "→ POST ${CONSUMER_URL}/management/v3/edrs/request"; fi
  EDR_ENTRIES=$(curl -s -X 'POST' \
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
      \"filterExpression\": [
        {
          \"operandLeft\": \"contractNegotiationId\",
          \"operator\": \"=\",
          \"operandRight\": \"${CONTRACT_NEGOTIATION_ID}\"
        }
      ]
    }")
  if [ "$DEBUG" = true ]; then echo "EDR entries:" && echo "$EDR_ENTRIES" | jq '.'; fi

  EDR_DATA_ID=$(echo "$EDR_ENTRIES" | jq -r --arg agr_id "$CONTRACT_NEGOTIATION_ID" \
    '.[] | select((.contractNegotiationId // ."edc:contractNegotiationId") == $agr_id) | (."@id" // ."@id") // empty')


  if [ -n "$EDR_DATA_ID" ]; then
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "EDR not yet available, waiting... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 5
done

EDR_DATA_ADDRESS=$(curl -s -X 'GET' \
  "${CONSUMER_URL}/management/v3/edrs/${EDR_DATA_ID}/dataaddress" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${CONSUMER_API_KEY}" \
  ${CURL_CERT_OPTS})

if [ "$DEBUG" = true ]; then echo "→ GET ${CONSUMER_URL}/management/v3/edrs/${TRANSFER_PROCESS_ID}/dataaddress"; fi
if [ "$DEBUG" = true ]; then echo "$EDR_DATA_ADDRESS" | jq '.'; fi

# Extract endpoint and authorization token
ENDPOINT=$(echo "$EDR_DATA_ADDRESS" | jq -r '.endpoint // ."edc:endpoint" // empty')
AUTHORIZATION=$(echo "$EDR_DATA_ADDRESS" | jq -r '.authorization // ."edc:authorization" // empty')

if [ -z "$ENDPOINT" ] || [ -z "$AUTHORIZATION" ]; then
  echo "ERROR: Could not extract endpoint or authorization from EDR"
  exit 1
fi

# Use HTTPS directly to avoid HTTP->HTTPS redirect
# ENDPOINT="${ENDPOINT/http:\/\//https://}"

echo -e "\nEndpoint: ${ENDPOINT}"
echo "Authorization: ${AUTHORIZATION:0:20}..."

# Step 5: Access the actual data from provider
echo -e "\n[5/5] Accessing data from provider..."
if [ "$DEBUG" = true ]; then echo "→ GET ${ENDPOINT}"; fi

HEADER_FILE=$(mktemp)
curl -s -X 'GET' \
  "${ENDPOINT}" \
  -H "Authorization: ${AUTHORIZATION}" \
  ${CURL_CERT_OPTS} \
  -D "$HEADER_FILE" \
  -o "/tmp/asset-data-raw"

# 1. Always capture Content-Type from response headers
CONTENT_TYPE=$(grep -i "^Content-Type:" "$HEADER_FILE" | head -1 | \
  sed 's/^[Cc]ontent-[Tt]ype:\s*//' | cut -d';' -f1 | tr -d ' \r\n')
echo "Detected Content-Type: ${CONTENT_TYPE}"

# 2. Determine file extension from Content-Disposition or Content-Type
CONTENT_DISPOSITION=$(grep -i "^Content-Disposition:" "$HEADER_FILE" | head -1)
DETECTED_FILENAME=$(echo "$CONTENT_DISPOSITION" | \
  sed -n 's/.*filename[^=]*=\s*"\?\([^";\r\n]*\)"\?.*/\1/Ip' | tr -d '\r')

if [ -n "$DETECTED_FILENAME" ]; then
  DETECTED_EXT=".${DETECTED_FILENAME##*.}"
  echo "Detected filename from Content-Disposition: ${DETECTED_FILENAME}"
else
  case "$CONTENT_TYPE" in
    text/turtle)                    DETECTED_EXT=".ttl"  ;;
    application/ld+json)            DETECTED_EXT=".jsonld" ;;
    application/json)               DETECTED_EXT=".json" ;;
    application/xml|text/xml)       DETECTED_EXT=".xml"  ;;
    text/csv)                       DETECTED_EXT=".csv"  ;;
    application/pdf)                DETECTED_EXT=".pdf"  ;;
    text/plain)                     DETECTED_EXT=".txt"  ;;
    *)                              DETECTED_EXT=".json" ;;
  esac
fi

rm -f "$HEADER_FILE"

OUTPUT_FILE="/tmp/asset-data${DETECTED_EXT}"
mv "/tmp/asset-data-raw" "$OUTPUT_FILE"
ln -sf "$OUTPUT_FILE" /tmp/asset-data
echo "$OUTPUT_FILE" > /tmp/output_filename.txt
echo "$CONTENT_TYPE" > /tmp/content_type.txt

echo -e "\n=========================================="
echo "Data consumption completed!"
echo "Asset data written to $OUTPUT_FILE"
echo "=========================================="
