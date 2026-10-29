# EDC Gateway

FastAPI microservice that acts as a unified gateway for interacting with multiple Eclipse Dataspace Connectors (EDC). Handles catalog requests, contract negotiations, EDRs, and data transfers — with OAuth2/RBAC authentication, PostgreSQL-backed configuration, Kubernetes secret management, and Argo Workflows integration for long-running operations.

## Architecture

```
Browser / API Client
        │ OAuth2 Bearer Token (Keycloak)
        ▼
┌──────────────────────────────────┐
│         FastAPI Gateway          │
│                                  │
│  Direct (synchronous):           │
│  - Catalog fetch                 │
│  - Negotiation status            │
│  - EDR / Transfer queries        │
│                                  │
│  Via Argo (async + SSE stream):  │
│  - consume-asset                 │
│  - create-asset                  │
└────────────┬─────────────────────┘
             │ writes K8s Secrets (api keys, oauth2 creds)
             │ submits Argo Workflows
             ▼
    ┌─────────────────┐     ┌──────────────────┐
    │  K8s Secrets    │     │   PostgreSQL      │
    │  (per EDC)      │     │   - EDC configs   │
    │  api keys       │     │   - RBAC          │
    │  oauth2 creds   │     │   - Job history   │
    └────────┬────────┘     └──────────────────┘
             │ mounted by
             ▼
    ┌─────────────────┐
    │  Argo Workflow  │──────► EDC Management API
    │  Pods           │
    └─────────────────┘
```

## Prerequisites

| Tool | Development | Production |
|------|-------------|------------|
| Docker + Compose | ✓ | ✓ |
| Python 3.11+ | ✓ | – |
| kubectl | – | ✓ |
| Kubernetes cluster | – | ✓ |
| Argo Workflows | – | ✓ |
| Keycloak | optional (mock token) | ✓ |

---

## Development Setup

### 1. Clone and install

```bash
git clone <repo-url> edc-gateway
cd edc-gateway

python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — minimum required for local dev:

```env
DATABASE_URL=postgresql+asyncpg://edc_gateway:secret@localhost:5432/edc_gateway
SECRET_ENCRYPTION_KEY=<generate below>

# Point to your local Keycloak or use a test value — see note below
OIDC_JWKS_URL=http://localhost:8080/realms/dev/protocol/openid-connect/certs
OIDC_ISSUER=http://localhost:8080/realms/dev
OIDC_AUDIENCE=edc-gateway

# Argo — not needed for direct-route development, only for consume/create endpoints
ARGO_SERVER_URL=http://localhost:2746
ARGO_NAMESPACE=argo

# K8s — set to false to use your local kubeconfig
K8S_IN_CLUSTER=false
K8S_NAMESPACE=edc-gateway
```

Generate a Fernet encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Start PostgreSQL

```bash
docker compose up db -d
```

### 4. Run database migrations

The tables are auto-created on startup via SQLAlchemy `create_all`. For production use Alembic instead (see Production section).

### 5. Start the API

```bash
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 6. Keycloak for local development (optional)

Add a minimal Keycloak to `docker-compose.yml`:

```yaml
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    command: start-dev
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports:
      - "8080:8080"
```

Then create a realm `dev`, a client `edc-gateway` (confidential, client credentials enabled), and update `.env` accordingly.

**Skipping auth for local testing:** You can temporarily disable the security dependency in `app/auth/rbac.py` by making `get_current_user` return a hardcoded user — but never commit this.

### 7. K8s secrets in local development

With `K8S_IN_CLUSTER=false` the gateway uses your local `~/.kube/config`. Create the namespace and a test secret:

```bash
kubectl create namespace edc-gateway

kubectl create secret generic edc-myedc-credentials \
  --from-literal=consumer_api_key=test123 \
  --from-literal=provider_api_key=test123 \
  -n edc-gateway
```

---

## Production Setup

### 1. Build images

Build from the parent directory of both repos (needed so `Dockerfile.scripts` can access `edc-example-scripts`):

```bash
cd /path/to/repos

# FastAPI image
docker build -f edc-gateway/Dockerfile \
  -t edc-gateway:latest edc-gateway/

# Scripts image (includes the EDC shell scripts + k8s-env-loader)
docker build -f edc-gateway/Dockerfile.scripts \
  --build-arg SCRIPTS_DIR=edc-example-scripts/examples \
  -t edc-gateway-scripts:latest .
```

Push both images to your registry and update the `image:` fields in `k8s/deployment.yaml` and `argo/workflow_templates/*.yaml`.

### 2. Apply Kubernetes RBAC

```bash
kubectl apply -f k8s/rbac.yaml
```

This creates:
- `ServiceAccount/edc-gateway` in namespace `edc-gateway` — used by the FastAPI pods to manage K8s secrets
- `ServiceAccount/edc-gateway-workflow` in namespace `argo` — used by Argo workflow pods to read EDC credential secrets

### 3. Create application secrets

```bash
# Generate a Fernet key
FERNET_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

kubectl create secret generic edc-gateway-app-secrets \
  --from-literal=database_url='postgresql+asyncpg://edc_gateway:PASSWORD@postgres-host:5432/edc_gateway' \
  --from-literal=encryption_key="$FERNET_KEY" \
  -n edc-gateway
```

### 4. Configure and deploy

Edit `k8s/deployment.yaml` — update the `ConfigMap` values:

```yaml
data:
  oidc_jwks_url: "https://keycloak.your-domain.com/realms/YOUR_REALM/protocol/openid-connect/certs"
  oidc_issuer: "https://keycloak.your-domain.com/realms/YOUR_REALM"
  oidc_audience: "edc-gateway"
  argo_server_url: "https://argo-server.argo.svc.cluster.local:2746"
  argo_namespace: "argo"
```

Then apply:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### 5. Run database migrations

```bash
# Port-forward to the DB or run migrations as a K8s Job
kubectl run migrate --rm -it \
  --image=edc-gateway:latest \
  --restart=Never \
  --env="DATABASE_URL=postgresql+asyncpg://..." \
  --env="SECRET_ENCRYPTION_KEY=..." \
  -- alembic upgrade head
```

### 6. Deploy Argo WorkflowTemplates

```bash
kubectl apply -f argo/workflow_templates/consume-asset.yaml
kubectl apply -f argo/workflow_templates/create-asset.yaml
```

### 7. Set up Keycloak

1. Create a realm (e.g. `edc-gateway`)
2. Create a client `edc-gateway` with:
   - Client authentication: on
   - Standard flow: on (for browser login)
   - Direct access grants: on (for API clients / scripts)
3. Note the client secret for your frontend/API clients
4. No EDC-specific roles are configured in Keycloak — all RBAC lives in the gateway's PostgreSQL

### 8. Bootstrap the first admin user

On first startup, users are auto-provisioned from their JWT `sub` claim with no roles. To bootstrap the first admin:

1. Get a token from Keycloak and make one request to the API (this creates your user record):
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://edc-gateway/health
   ```

2. Create the admin role directly in PostgreSQL:
   ```sql
   INSERT INTO roles (id, name, description)
   VALUES (gen_random_uuid(), 'admin', 'Full access');

   INSERT INTO role_permissions (role_id, permission)
   SELECT id, 'edc:*:manage'   FROM roles WHERE name = 'admin'
   UNION ALL
   SELECT id, 'edc:*:consume'  FROM roles WHERE name = 'admin'
   UNION ALL
   SELECT id, 'edc:*:create_asset' FROM roles WHERE name = 'admin'
   UNION ALL
   SELECT id, 'edc:*:catalog'  FROM roles WHERE name = 'admin'
   UNION ALL
   SELECT id, 'edc:*:status'   FROM roles WHERE name = 'admin'
   UNION ALL
   SELECT id, 'users:*:manage' FROM roles WHERE name = 'admin';

   INSERT INTO user_roles (user_id, role_id)
   SELECT u.id, r.id FROM users u, roles r
   WHERE u.email = 'your-email@example.com' AND r.name = 'admin';
   ```

3. From this point, all role and user management goes through the API:
   ```bash
   # Create an operator role for a specific EDC
   curl -X POST http://edc-gateway/admin/roles \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"name": "operator-catena-x", "permissions": ["edc:catena-x-prod:consume", "edc:catena-x-prod:catalog", "edc:catena-x-prod:status"]}'
   ```

### 9. Register your first EDC

```bash
curl -X POST http://edc-gateway/admin/edcs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "catena-x-prod",
    "display_name": "Catena-X Production",
    "consumer_url": "https://consumer-edc.example.com",
    "provider_url": "https://provider-edc.example.com",
    "provider_did": "did:web:provider-edc.example.com",
    "provider_bpn": "BPNL000000000001",
    "provider_dsp_url": "https://provider-edc.example.com/api/dsp",
    "use_2025_1": true,
    "use_edrs": true,
    "secrets": {
      "consumer_api_key": "...",
      "provider_api_key": "...",
      "oauth2_token_url": "https://auth.example.com/token",
      "oauth2_client_id": "my-client",
      "oauth2_client_secret_key": "my-secret"
    }
  }'
```

This atomically writes the non-sensitive config to PostgreSQL and the credentials to a K8s secret `edc-catena-x-prod-credentials` in the `edc-gateway` namespace.

---

## Example Scripts

The `examples/` directory contains ready-to-run Python scripts for every workflow.

### Setup

```bash
pip install -e ".[examples]"
cp examples/.env.example examples/.env
# Fill in GATEWAY_URL, KEYCLOAK_TOKEN_URL, credentials
```

### Scripts

| Script | Description |
|--------|-------------|
| [`examples/_client.py`](examples/_client.py) | Shared helper: token fetch, `httpx` client, `stream_job()` SSE helper |
| [`examples/01_register_edc.py`](examples/01_register_edc.py) | Register an EDC, list all EDCs, rotate secrets |
| [`examples/02_manage_roles.py`](examples/02_manage_roles.py) | Create roles with permissions, list users, assign roles |
| [`examples/03_fetch_catalog.py`](examples/03_fetch_catalog.py) | Fetch full catalog, filter by asset ID, ad-hoc provider override |
| [`examples/04_consume_asset.py`](examples/04_consume_asset.py) | Submit consume-asset workflow, stream live progress via SSE |
| [`examples/05_create_asset.py`](examples/05_create_asset.py) | Create asset (URL / file / OAuth2 backend), stream progress via SSE |
| [`examples/06_check_status.py`](examples/06_check_status.py) | Check negotiations, EDRs, transfer processes, job history |
| [`examples/07_full_workflow.py`](examples/07_full_workflow.py) | End-to-end: register → roles → create asset → catalog → consume |

### Quick start

```bash
cd examples

# Complete end-to-end demo
python 07_full_workflow.py

# Individual scripts
python 01_register_edc.py
python 03_fetch_catalog.py
python 04_consume_asset.py urn:uuid:12345678-1234-1234-1234-123456789abc
python 06_check_status.py
```

---

## API Reference

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/edcs` | List registered EDCs | any authenticated user |
| GET | `/edcs/{id}` | EDC details | any authenticated user |
| POST | `/edcs/{id}/catalog` | Fetch provider catalog (direct) | `edc:{id}:catalog` |
| GET | `/edcs/{id}/negotiations` | List contract negotiations | `edc:{id}:status` |
| GET | `/edcs/{id}/negotiations/{nid}` | Negotiation status | `edc:{id}:status` |
| GET | `/edcs/{id}/edrs` | List EDRs | `edc:{id}:status` |
| GET | `/edcs/{id}/edrs/{eid}/dataaddress` | EDR data address | `edc:{id}:status` |
| GET | `/edcs/{id}/transfers` | List transfer processes | `edc:{id}:status` |
| GET | `/edcs/{id}/transfers/{tid}/state` | Transfer state | `edc:{id}:status` |
| POST | `/edcs/{id}/consume` | Start asset consumption (→ Argo) | `edc:{id}:consume` |
| POST | `/edcs/{id}/assets` | Create asset (→ Argo) | `edc:{id}:create_asset` |
| GET | `/jobs` | List own jobs | authenticated |
| GET | `/jobs/{id}` | Job details | authenticated (own jobs) |
| GET | `/jobs/{id}/stream` | **SSE** live status stream | authenticated (own jobs) |
| POST | `/admin/edcs` | Register EDC + write K8s secret | `edc:*:manage` |
| PATCH | `/admin/edcs/{id}` | Update EDC config / rotate secrets | `edc:*:manage` |
| DELETE | `/admin/edcs/{id}` | Delete EDC + K8s secret | `edc:*:manage` |
| GET | `/admin/users` | List users | `users:*:manage` |
| PUT | `/admin/users/{id}/roles` | Assign roles to user | `users:*:manage` |
| POST | `/admin/roles` | Create role with permissions | `users:*:manage` |
| GET | `/admin/roles` | List roles | `users:*:manage` |

### SSE Stream usage

```python
# Python — httpx streaming
import httpx, json

with httpx.Client() as client:
    with client.stream("GET", "http://edc-gateway/jobs/{id}/stream",
                       headers={"Authorization": f"Bearer {token}"}) as r:
        for line in r.iter_lines():
            if line.startswith("data:"):
                event = json.loads(line[5:])
                print(event)
                if event.get("status") in ("succeeded", "failed"):
                    break
```

```javascript
// Browser — native EventSource
const es = new EventSource(`/jobs/${jobId}/stream`, {
  headers: { Authorization: `Bearer ${token}` }
});
es.addEventListener("status", e => console.log(JSON.parse(e.data)));
es.addEventListener("done",   e => { console.log("done", e.data); es.close(); });
es.addEventListener("failed", e => { console.error(e.data); es.close(); });
```

---

## Permission Reference

Permissions follow the format `resource:scope:action`.

| Permission | Description |
|------------|-------------|
| `edc:*:manage` | Register, update, delete any EDC (admin only) |
| `edc:{id}:consume` | Trigger asset consumption on a specific EDC |
| `edc:{id}:create_asset` | Create assets on a specific EDC |
| `edc:{id}:catalog` | Fetch catalog from a specific EDC |
| `edc:{id}:status` | View negotiations, EDRs, transfers on a specific EDC |
| `users:*:manage` | Manage users and roles (admin only) |

Use `*` as the scope wildcard: `edc:*:consume` grants consume access on all EDCs.

## AI-Assisted Documentation

Parts of this repository were created with the assistance of artificial intelligence (AI) tools. While the content has been reviewed and edited for accuracy, users should:

- Verify critical information independently
- Report any errors or inconsistencies via the GitHub issue tracker
- Exercise due diligence when following instructions
- The use of AI does not affect the functionality or reliability of the software itself.
