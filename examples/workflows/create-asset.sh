#!/bin/bash

source .env.create

# Build cert options if CLIENT_CERT_PATH is set
if [ -n "${CLIENT_CERT_PATH}" ]; then
  CURL_CERT_OPTS="--cert-type P12 --cert ${CLIENT_CERT_PATH}:${CLIENT_CERT_PASSWORD}"
else
  CURL_CERT_OPTS=""
fi

# Parse command line arguments
FULL_POLICY=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --full-policy|-f) FULL_POLICY=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

UUID=$(uuidgen -r)
SID="urn:uuid:${UUID}"

# Generate IDs for policies and contract
USAGE_POLICY_ID="usage-policy-${UUID}"
ACCESS_POLICY_ID="access-policy-${UUID}"
CONTRACT_DEFINITION_ID="contract-def-${UUID}"

echo "=========================================="
echo "Creating Asset with ID: ${SID}"
if [ "$FULL_POLICY" = true ]; then
  echo "Policy Mode: Full Catena-X Compliance (Membership + Framework + BPN)"
else
  echo "Policy Mode: Simplified (BPN only)"
fi
echo "=========================================="

# Step 1: Upload asset to submodel server (skipped when ASSET_PATH is an https URL)
if [[ "${ASSET_PATH}" =~ ^https:// ]]; then
  echo -e "\n[1/5] ASSET_PATH is an https URL — skipping upload, using URL directly as data address."
  ASSET_DATA_BASE_URL="${ASSET_PATH}"
else
  echo -e "\n[1/5] Uploading asset to submodel server..."
  curl -i \
    -H "Content-Type: ${ASSET_TYPE}" \
    -d "@${ASSET_PATH}" \
    ${CURL_CERT_OPTS} \
    "${PROVIDER_SUBMODEL_SERVER}/${SID}"
  ASSET_DATA_BASE_URL="${PROVIDER_SUBMODEL_SERVER}/${SID}"
fi

# Build optional asset properties
OPTIONAL_PROPS=""
if [ -n "${ASSET_SUBTYPE}" ]; then
  OPTIONAL_PROPS="${OPTIONAL_PROPS},
    \"asset_type\": \"${ASSET_SUBTYPE}\""
fi
if [ -n "${ASSET_ID_SHORT}" ]; then
  OPTIONAL_PROPS="${OPTIONAL_PROPS},
    \"idShort\": \"${ASSET_ID_SHORT}\""
fi
if [ -n "${ASSET_BASE64_URL}" ]; then
  OPTIONAL_PROPS="${OPTIONAL_PROPS},
    \"base64\": \"${ASSET_BASE64_URL}\""
fi

# Build data address — OAuth2 if OAUTH2_TOKEN_URL is set, otherwise simple HttpData
if [ -n "${OAUTH2_TOKEN_URL}" ]; then
  ASSET_DATA_ADDRESS="{
    \"@type\": \"DataAddress\",
    \"type\": \"HttpData\",
    \"baseUrl\": \"${DATA_ADDRESS_BASE_URL}\",
    \"name\": \"${DATA_ADDRESS_NAME}\",
    \"proxyPath\": \"false\",
    \"proxyBody\": \"false\",
    \"proxyMethod\": \"false\",
    \"proxyQueryParams\": \"true\",
    \"oauth2:tokenUrl\": \"${OAUTH2_TOKEN_URL}\",
    \"oauth2:clientId\": \"${OAUTH2_CLIENT_ID}\",
    \"oauth2:clientSecretKey\": \"${OAUTH2_CLIENT_SECRET_KEY}\",
    \"oauth2:grantType\": \"${OAUTH2_GRANT_TYPE:-client_credentials}\"
  }"
else
  ASSET_DATA_ADDRESS="{
    \"@type\": \"DataAddress\",
    \"type\": \"HttpData\",
    \"baseUrl\": \"${ASSET_DATA_BASE_URL}\",
    \"proxyPath\": \"true\",
    \"proxyBody\": \"true\",
    \"proxyMethod\": \"true\",
    \"proxyQueryParams\": \"true\"
  }"
fi

# Step 2: Register asset in EDC
echo -e "\n[2/5] Registering asset in EDC..."
curl -X 'POST' \
  "${PROVIDER_URL}/management/v3/assets" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  ${CURL_CERT_OPTS} \
  -d "{
  \"@context\": {
    \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\"
  },
  \"@id\": \"${SID}\",
  \"properties\": {
    \"name\": \"${ASSET_NAME}\",
    \"description\": \"${ASSET_DESCRIPTION}\",
    \"contenttype\": \"${ASSET_TYPE}\"${OPTIONAL_PROPS}
  },
  \"dataAddress\": ${ASSET_DATA_ADDRESS}
}" | jq '.'

# Step 3: Create Usage Policy
echo -e "\n[3/5] Creating usage policy with ID: ${USAGE_POLICY_ID}..."

# Build usage constraint based on policy mode
if [ "$FULL_POLICY" = true ]; then
  # Full policy: Membership + FrameworkAgreement + UsagePurpose
  USAGE_CONSTRAINTS="[
            {
              \"leftOperand\": \"Membership\",
              \"operator\": \"eq\",
              \"rightOperand\": \"active\"
            },
            {
              \"leftOperand\": \"FrameworkAgreement\",
              \"operator\": \"eq\",
              \"rightOperand\": \"DataExchangeGovernance:1.0\"
            },
            {
              \"leftOperand\": \"UsagePurpose\",
              \"operator\": \"isAnyOf\",
              \"rightOperand\": [
                \"cx.core.industrycore:1\"
              ]
            }
          ]"
else
  # Simplified policy: FrameworkAgreement + UsagePurpose (no Membership)
  USAGE_CONSTRAINTS="[
            {
              \"leftOperand\": \"FrameworkAgreement\",
              \"operator\": \"eq\",
              \"rightOperand\": \"DataExchangeGovernance:1.0\"
            },
            {
              \"leftOperand\": \"UsagePurpose\",
              \"operator\": \"isAnyOf\",
              \"rightOperand\": [
                \"cx.core.industrycore:1\"
              ]
            }
          ]"
fi

curl -X 'POST' \
  "${PROVIDER_URL}/management/v3/policydefinitions" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  ${CURL_CERT_OPTS} \
  -d "{
  \"@context\": [
    \"https://w3id.org/catenax/2025/9/policy/odrl.jsonld\",
    \"https://w3id.org/catenax/2025/9/policy/context.jsonld\",
    {
      \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\"
    }
  ],
  \"@type\": \"PolicyDefinition\",
  \"@id\": \"${USAGE_POLICY_ID}\",
  \"policy\": {
    \"@type\": \"Set\",
    \"permission\": [
      {
        \"action\": \"use\",
        \"constraint\": {
          \"and\": ${USAGE_CONSTRAINTS}
        }
      }
    ],
    \"prohibition\": [],
    \"obligation\": []
  }
}" | jq '.'

# Step 4: Create Access Policy
echo -e "\n[4/5] Creating access policy with ID: ${ACCESS_POLICY_ID}..."

# Build constraint based on policy mode
if [ "$FULL_POLICY" = true ]; then
  # Full Catena-X policy with Membership, FrameworkAgreement and BPN
  ACCESS_CONSTRAINT="{
              \"and\": [
                {
                  \"leftOperand\": \"Membership\",
                  \"operator\": \"eq\",
                  \"rightOperand\": \"active\"
                },
                {
                  \"leftOperand\": \"FrameworkAgreement\",
                  \"operator\": \"eq\",
                  \"rightOperand\": \"DataExchangeGovernance:1.0\"
                },
                {
                  \"leftOperand\": \"BusinessPartnerNumber\",
                  \"operator\": \"isAnyOf\",
                  \"rightOperand\": [\"${CONSUMER_BPN}\"]
                }
              ]
            }"
else
  # Simplified policy with BPN only
  ACCESS_CONSTRAINT="{
              \"leftOperand\": \"BusinessPartnerNumber\",
              \"operator\": \"isAnyOf\",
              \"rightOperand\": [\"${CONSUMER_BPN}\"]
            }"
  # ACCESS_CONSTRAINT=""
fi

curl -X 'POST' \
  "${PROVIDER_URL}/management/v3/policydefinitions" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  ${CURL_CERT_OPTS} \
  -d "{
  \"@context\": [
    \"https://w3id.org/catenax/2025/9/policy/odrl.jsonld\",
    \"https://w3id.org/catenax/2025/9/policy/context.jsonld\",
    {
      \"@vocab\": \"https://w3id.org/edc/v0.0.1/ns/\"
    }
  ],
  \"@type\": \"PolicyDefinition\",
  \"@id\": \"${ACCESS_POLICY_ID}\",
  \"policy\": {
    \"@type\": \"Set\",
    \"permission\": [
      {
        \"action\": \"access\",
        \"constraint\": [
            ${ACCESS_CONSTRAINT}
        ]
      }
    ]
  }
}" | jq '.'

# Step 5: Create Contract Definition
echo -e "\n[5/5] Creating contract definition with ID: ${CONTRACT_DEFINITION_ID}..."
curl -X 'POST' \
  "${PROVIDER_URL}/management/v3/contractdefinitions" \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  ${CURL_CERT_OPTS} \
  -d "{
  \"@context\": {},
  \"@id\": \"${CONTRACT_DEFINITION_ID}\",
  \"@type\": \"ContractDefinition\",
  \"accessPolicyId\": \"${ACCESS_POLICY_ID}\",
  \"contractPolicyId\": \"${USAGE_POLICY_ID}\",
  \"assetsSelector\": {
    \"@type\": \"CriterionDto\",
    \"operandLeft\": \"https://w3id.org/edc/v0.0.1/ns/id\",
    \"operator\": \"=\",
    \"operandRight\": \"${SID}\"
  }
}" | jq '.'

echo -e "\n=========================================="
echo "Asset creation completed!"
echo "=========================================="
echo "Asset ID: ${SID}"
echo "Usage Policy ID: ${USAGE_POLICY_ID}"
echo "Access Policy ID: ${ACCESS_POLICY_ID}"
echo "Contract Definition ID: ${CONTRACT_DEFINITION_ID}"
echo "=========================================="

printf '%s' "$SID" > /tmp/asset_id.txt
printf '%s' "$USAGE_POLICY_ID" > /tmp/usage_policy_id.txt
printf '%s' "$ACCESS_POLICY_ID" > /tmp/access_policy_id.txt
printf '%s' "$CONTRACT_DEFINITION_ID" > /tmp/contract_definition_id.txt
echo "Asset IDs written to /tmp/asset_id.txt, /tmp/usage_policy_id.txt, /tmp/access_policy_id.txt, /tmp/contract_definition_id.txt"
