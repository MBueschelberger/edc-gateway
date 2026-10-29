#!/bin/bash

source .env.create


# IDs printed at the end of create-asset.sh output
SID="urn:uuid:${1}"
ACCESS_POLICY_ID="access-policy-${1}"
USAGE_POLICY_ID="usage-policy-${1}"
CONTRACT_DEF_ID="contract-def-${1}"

if [ -z "$1" ]; then
  echo "Usage: $0 <uuid>"
  exit 1
fi

DEBUG="${DEBUG:-false}"

echo "=========================================="
echo "Deleting Asset: ${SID}"
echo "Debug:          ${DEBUG}"
echo "=========================================="

# Step 1: Terminate active contract negotiations for this asset
echo -e "\n[1/6] Searching for contract negotiations for asset: ${SID}..."
PAYLOAD='{
    "@context": { "@vocab": "https://w3id.org/edc/v0.0.1/ns/" },
    "@type": "QuerySpec",
    "filterExpression": [
      {
        "operandLeft": "contractOffers.assetId",
        "operator": "=",
        "operandRight": "'"${SID}"'"
      }
    ]
  }'
if [ "$DEBUG" = true ]; then echo "Payload:" && echo "$PAYLOAD" | jq '.'; fi
if [ "$DEBUG" = true ]; then echo "→ POST ${PROVIDER_URL}/management/v3/contractnegotiations/request"; fi
NEGOTIATIONS=$(curl -s -X POST \
  "${PROVIDER_URL}/management/v3/contractnegotiations/request" \
  -H "x-api-key: ${PROVIDER_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD")
if [ "$DEBUG" = true ]; then echo "Response:" && echo "$NEGOTIATIONS" | jq '.'; fi

NEGOTIATION_IDS=$(echo "${NEGOTIATIONS}" | jq -r '.[] | select(.["@id"] != null) | .["@id"]' 2>/dev/null)

if [ -z "${NEGOTIATION_IDS}" ]; then
  echo "  No contract negotiations found."
else
  while IFS= read -r NEG_ID; do
    STATE=$(echo "${NEGOTIATIONS}" | jq -r '.[] | select(.["@id"] == "'"${NEG_ID}"'") | .state' 2>/dev/null)
    echo "  Negotiation ${NEG_ID} — state: ${STATE}"

    # Terminate only if not already in a terminal state
    if [[ "${STATE}" != "FINALIZED" && "${STATE}" != "TERMINATED" && "${STATE}" != "ERROR" ]]; then
      echo "  -> Terminating..."
      PAYLOAD='{
          "@context": { "@vocab": "https://w3id.org/edc/v0.0.1/ns/" },
          "@id": "'"${NEG_ID}"'",
          "reason": "asset deleted"
        }'
      if [ "$DEBUG" = true ]; then echo "Payload:" && echo "$PAYLOAD" | jq '.'; fi
      if [ "$DEBUG" = true ]; then echo "→ POST ${PROVIDER_URL}/management/v3/contractnegotiations/${NEG_ID}/terminate"; fi
      TERMINATE_RESPONSE=$(curl -s -X POST \
        "${PROVIDER_URL}/management/v3/contractnegotiations/${NEG_ID}/terminate" \
        -H "x-api-key: ${PROVIDER_API_KEY}" \
        -H 'Content-Type: application/json' \
        -d "$PAYLOAD")
      if [ -n "$TERMINATE_RESPONSE" ]; then
        echo "$TERMINATE_RESPONSE" | jq '.' 2>/dev/null || echo "$TERMINATE_RESPONSE"
      fi
    else
      echo "  -> Already terminal, skipping terminate."
    fi
  done <<< "${NEGOTIATION_IDS}"
fi

# # Step 2: Retire contract agreements for this asset
# echo -e "\n[2/6] Searching for contract agreements for asset: ${SID}..."
# PAYLOAD='{
#     "@context": { "@vocab": "https://w3id.org/edc/v0.0.1/ns/" },
#     "@type": "QuerySpec",
#     "filterExpression": [
#       {
#         "operandLeft": "assetId",
#         "operator": "=",
#         "operandRight": "'"${SID}"'"
#       }
#     ]
#   }'
# if [ "$DEBUG" = true ]; then echo "Payload:" && echo "$PAYLOAD" | jq '.'; fi
# if [ "$DEBUG" = true ]; then echo "→ POST ${PROVIDER_URL}/management/v3/contractagreements/request"; fi
# AGREEMENTS=$(curl -s -X POST \
#   "${PROVIDER_URL}/management/v3/contractagreements/request" \
#   -H "x-api-key: ${PROVIDER_API_KEY}" \
#   -H 'Content-Type: application/json' \
#   -d "$PAYLOAD")
# if [ "$DEBUG" = true ]; then echo "Response:" && echo "$AGREEMENTS" | jq '.'; fi

# AGREEMENT_IDS=$(echo "${AGREEMENTS}" | jq -r '.[] | select(.["@id"] != null) | .["@id"]' 2>/dev/null)

# if [ -z "${AGREEMENT_IDS}" ]; then
#   echo "  No contract agreements found."
# else
#   while IFS= read -r AGR_ID; do
#     echo "  Retiring agreement ${AGR_ID}..."
#     PAYLOAD='{
#         "@context": {
#           "@vocab": "https://w3id.org/edc/v0.0.1/ns/",
#           "tx": "https://w3id.org/tractusx/v0.0.1/ns/"
#         },
#         "@type": "AgreementsRetirementEntry",
#         "agreementId": "'"${AGR_ID}"'",
#         "tx:reason": "asset deleted"
#       }'
#     if [ "$DEBUG" = true ]; then echo "Payload:" && echo "$PAYLOAD" | jq '.'; fi
#     if [ "$DEBUG" = true ]; then echo "→ POST ${PROVIDER_URL}/management/v3/contractagreements/retirements"; fi
#     RETIRE_RESPONSE=$(curl -s -X POST \
#       "${PROVIDER_URL}/management/v3/contractagreements/retirements" \
#       -H "x-api-key: ${PROVIDER_API_KEY}" \
#       -H 'Content-Type: application/json' \
#       -d "$PAYLOAD")
#     if [ -n "$RETIRE_RESPONSE" ]; then
#       echo "$RETIRE_RESPONSE" | jq '.' 2>/dev/null || echo "$RETIRE_RESPONSE"
#     fi
#   done <<< "${AGREEMENT_IDS}"
# fi

# Step 3: Delete Contract Definition first (it references the policies)
echo -e "\n[3/6] Deleting contract definition: ${CONTRACT_DEF_ID}..."
if [ "$DEBUG" = true ]; then echo "→ DELETE ${PROVIDER_URL}/management/v3/contractdefinitions/${CONTRACT_DEF_ID}"; fi
DELETE_RESPONSE=$(curl -s -X DELETE \
  "${PROVIDER_URL}/management/v3/contractdefinitions/${CONTRACT_DEF_ID}" \
  -H "x-api-key: ${PROVIDER_API_KEY}")
if [ -n "$DELETE_RESPONSE" ]; then
  echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
fi

# Step 4: Delete Access Policy
echo -e "\n[4/6] Deleting access policy: ${ACCESS_POLICY_ID}..."
if [ "$DEBUG" = true ]; then echo "→ DELETE ${PROVIDER_URL}/management/v3/policydefinitions/${ACCESS_POLICY_ID}"; fi
DELETE_RESPONSE=$(curl -s -X DELETE \
  "${PROVIDER_URL}/management/v3/policydefinitions/${ACCESS_POLICY_ID}" \
  -H "x-api-key: ${PROVIDER_API_KEY}")
if [ -n "$DELETE_RESPONSE" ]; then
  echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
fi

# Step 5: Delete Usage Policy
echo -e "\n[5/6] Deleting usage policy: ${USAGE_POLICY_ID}..."
if [ "$DEBUG" = true ]; then echo "→ DELETE ${PROVIDER_URL}/management/v3/policydefinitions/${USAGE_POLICY_ID}"; fi
DELETE_RESPONSE=$(curl -s -X DELETE \
  "${PROVIDER_URL}/management/v3/policydefinitions/${USAGE_POLICY_ID}" \
  -H "x-api-key: ${PROVIDER_API_KEY}")
if [ -n "$DELETE_RESPONSE" ]; then
  echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
fi

# # Step 6: Delete Asset
# echo -e "\n[6/6] Deleting asset: ${SID}..."
# if [ "$DEBUG" = true ]; then echo "→ DELETE ${PROVIDER_URL}/management/v3/assets/${SID}"; fi
# DELETE_RESPONSE=$(curl -s -X DELETE \
#   "${PROVIDER_URL}/management/v3/assets/${SID}" \
#   -H "x-api-key: ${PROVIDER_API_KEY}")
# if [ -n "$DELETE_RESPONSE" ]; then
#   echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
# fi

echo -e "\n=========================================="
echo "Deletion completed."
echo "=========================================="
