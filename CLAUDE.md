# EDC Gateway — Claude Code Context

## What this project is

FastAPI microservice that acts as a unified gateway for multiple Eclipse Dataspace Connectors (EDC). It abstracts away EDC-specific HTTP interactions (catalog requests, contract negotiations, EDRs, data transfers) and exposes a clean REST API secured with OAuth2/RBAC via Keycloak.

Long-running operations (consume-asset, create-asset) are offloaded to **Argo Workflows**. Short read-only operations (catalog, negotiation status, EDRs) are executed **directly and synchronously**.

## Tech stack

- **FastAPI** + **SQLAlchemy 2.0 async** + **asyncpg** (PostgreSQL)
- **Pydantic v2** — all models use `Field(...)` with `description=`
- **python-jose** for JWT verification against Keycloak JWKS endpoint
- **httpx** for all outbound HTTP (EDC Management API, Argo REST API)
- **kubernetes** Python client for K8s secret management
- **cryptography (Fernet)** for encrypting FastAPI-side secrets in PostgreSQL
- **sse-starlette** for SSE streaming on `/jobs/{id}/stream`
- **Alembic** for DB migrations

## Project layout

```
app/
  config/settings.py       # Pydantic-settings, all config from env vars
  db/
    models.py              # SQLAlchemy ORM models (EDCConfig, User, Role, Job, …)
    session.py             # AsyncSession factory + get_session dependency
  models/                  # Pydantic request/response schemas (NOT ORM models)
    edc.py                 # EDCCreateRequest, EDCUpdateRequest, EDCResponse, EDCSecrets
    job.py                 # JobResponse, ConsumeAssetRequest, CreateAssetRequest
    user.py                # UserResponse, RoleCreateRequest, RoleResponse, AssignRolesRequest
  auth/
    oauth2.py              # JWKS fetch + JWT decode (with key-rotation retry)
    rbac.py                # get_current_user, require_permission, require_edc_permission
  services/
    k8s_client.py          # create_or_update_secret / delete_secret / read_secret
    edc_client.py          # direct async calls to EDC Management API
    argo_client.py         # submit_workflow / get_workflow_phase / get_workflow_logs
    crypto.py              # Fernet encrypt/decrypt for PostgreSQL-stored secrets
  routers/
    edcs.py                # GET /edcs, GET /edcs/{id}  (public, any authenticated user)
    catalog.py             # POST /edcs/{id}/catalog    (direct, synchronous)
    negotiations.py        # GET  /edcs/{id}/negotiations[/{id}]  (direct)
    edrs.py                # GET  /edcs/{id}/edrs[/{id}/dataaddress]  (direct)
    transfers.py           # GET  /edcs/{id}/transfers[/{id}/state]  (direct)
    consume.py             # POST /edcs/{id}/consume    (→ Argo, returns job)
    assets.py              # POST /edcs/{id}/assets     (→ Argo, returns job)
    jobs.py                # GET /jobs, GET /jobs/{id}, GET /jobs/{id}/stream (SSE)
    admin/
      edcs.py              # CRUD /admin/edcs  — writes K8s secrets on create/update
      users.py             # /admin/users, /admin/roles
  main.py                  # FastAPI app, lifespan (create_all), router registration, CORS

argo/
  scripts/
    k8s-env-loader.sh           # Reads K8s secret via service account token, exports as env vars
  consume-asset.yaml            # Argo WorkflowTemplate: fetch EDC asset → /tmp/asset-data.ttl
                                #   outputs: asset-data artifact, asset_title, asset_description
  create-asset.yaml             # Argo WorkflowTemplate: register asset in provider EDC
  asset-2-ckan.yaml             # Argo WorkflowTemplate: upload asset-data artifact to CKAN
                                #   reads target_storage_* from K8s secret; outputs ckan_dataset_url, ckan_resource_url
  consume-asset-2-ckan.yaml     # Argo WorkflowTemplate: orchestrator — consume-asset → asset-2-ckan

k8s/
  rbac.yaml                # ServiceAccounts + Roles for FastAPI pod and Argo workflow pods
  deployment.yaml          # Deployment, ConfigMap, Secret placeholder
  service.yaml             # ClusterIP Service + Ingress (with proxy-buffering: off for SSE)

migrations/
  env.py                   # Alembic async setup
  versions/                # Migration files

examples/                  # Standalone Python scripts demonstrating every workflow
  _client.py               # Shared: token fetch, httpx client, stream_job() SSE helper
  workflows/
    consume-asset.sh       # Source script (also baked into workflows Docker image)
```

## Key architectural decisions

### Secret storage split

Secrets are split based on who needs them at runtime:

| Secret | Storage | Why |
|--------|---------|-----|
| EDC API keys, client cert passwords, OAuth2 DataAddress creds, target storage creds | **K8s Secret** per EDC (`edc-{id}-credentials`) | Argo workflow pods need them as env vars at runtime |
| FastAPI-side secrets (BDRS creds, data backend creds) | **PostgreSQL** (`edc_fastapi_secrets`, Fernet-encrypted) | Only FastAPI reads them; never needed by Argo |
| App encryption key | **K8s Secret** mounted as env var into FastAPI deployment | Standard K8s practice, rotatable |

The admin never touches K8s directly — `POST /admin/edcs` atomically writes to PostgreSQL AND calls `k8s_client.create_or_update_secret()`.

#### K8s secret keys per EDC

All keys in `edc-{id}-credentials` are `optional: true` in workflow templates:

| Key | Argo env var | Purpose |
|-----|-------------|---------|
| `consumer_api_key` | `CONSUMER_API_KEY` | Consumer EDC management API |
| `provider_api_key` | `PROVIDER_API_KEY` | Provider EDC management API |
| `client_cert_path` | `CLIENT_CERT_PATH` | P12 cert path for mTLS |
| `client_cert_password` | `CLIENT_CERT_PASSWORD` | P12 cert password |
| `oauth2_token_url` | `OAUTH2_TOKEN_URL` | OAuth2 token endpoint |
| `oauth2_client_id` | `OAUTH2_CLIENT_ID` | OAuth2 client ID |
| `oauth2_client_secret_key` | `OAUTH2_CLIENT_SECRET_KEY` | OAuth2 client secret |
| `oauth2_grant_type` | `OAUTH2_GRANT_TYPE` | OAuth2 grant type (default: `client_credentials`) |
| `bpn_discovery_client_id` | — | BPN Discovery OAuth2 client ID (FastAPI only) |
| `bpn_discovery_client_secret` | — | BPN Discovery OAuth2 client secret (FastAPI only) |
| `target_storage_url` | `CKAN_URL` | Target storage base URL (e.g. CKAN) |
| `target_storage_user_key` | `CKAN_TOKEN` | Target storage API token |
| `target_storage_user_secret` | — | Additional secret for the target storage backend |
| `target_storage_owner_org_id` | `CKAN_OWNER_ORG` | Owner organisation ID for the target storage backend (e.g. CKAN owner org) |

### Dynamic K8s secret names in Argo

Raw Kubernetes does not support template variable substitution in `secretKeyRef.name`, but **Argo Workflows does**: the Argo controller substitutes `{{inputs.parameters.edc_id}}` before creating the pod spec, so Kubernetes sees the already-resolved secret name.

All credential env vars are declared directly in the `env` section of each WorkflowTemplate using `valueFrom.secretKeyRef` with `name: "edc-{{inputs.parameters.edc_id}}-credentials"`. All credential keys use `optional: true` because different EDC configurations may omit certain keys (e.g. an API-key-only EDC won't have OAuth2 keys). `OAUTH2_GRANT_TYPE` additionally falls back to `client_credentials` via a shell default in the `args` block.

The `argo/scripts/k8s-env-loader.sh` script is no longer used by the workflow templates.

### Per-EDC Argo workflow templates

Each EDC stores two non-nullable workflow template names in PostgreSQL:

| Field | Default | Used by |
|-------|---------|---------|
| `argo_consume_template` | `consume-asset` | `POST /edcs/{id}/consume` |
| `argo_create_asset_template` | `create-asset` | `POST /edcs/{id}/assets` |

The admin sets these via `POST /admin/edcs` or `PATCH /admin/edcs/{id}`. Setting `argo_consume_template` to `consume-asset-2-ckan` makes every consume operation on that EDC automatically upload the fetched asset to CKAN using the target storage credentials from the same K8s secret.

### CKAN upload pipeline (`consume-asset-2-ckan`)

The `consume-asset-2-ckan` WorkflowTemplate is a two-step orchestrator:

1. **`consume-asset`** — fetches the EDC asset; outputs the downloaded file as the `asset-data` artifact (`.ttl` extension by default) plus `asset_title` and `asset_description` output parameters extracted via `jq` from the catalog response.
2. **`asset-2-ckan`** — receives the artifact and metadata parameters; generates a `metadata.py` for `ckan_cli`; runs `ckan integrate`; queries the CKAN API for the resource URL; writes `ckan_dataset_url` and `ckan_resource_url` as output parameters.

The final output parameters (`ckan_dataset_url`, `ckan_resource_url`) are surfaced in the frontend Job Detail drawer as clickable links.

### RBAC

- Keycloak handles **authentication** (JWT issuance, JWKS endpoint)
- PostgreSQL handles **authorization** (users, roles, permissions)
- Users are auto-provisioned on first login (JWT `sub` → `users` table), with no roles
- Permissions are structured objects with three fields stored as separate columns in `role_permissions`:
  - `scope` — `PermissionScope.EDC` (`"edc"`) or `PermissionScope.USER` (`"user"`)
  - `instance` — `"*"` (wildcard) or a specific EDC ID; `user` scope only allows `"*"`
  - `operation` — `EDCOperation` values (`manage`, `consume`, `create_asset`, `catalog`, `status`, `bpn-discovery`) or `UserOperation` values (`manage`)
- Each `RolePermission` row has its own UUID `id` for stable frontend references
- `require_edc_permission(EDCOperation.CONSUME)` issues a single targeted DB query against `(scope, instance IN [edc_id, "*"], operation)` — no Python-side matching
- `require_permission(PermissionScope.USER, "*", UserOperation.MANAGE)` is the static variant for admin routes

### Argo vs. direct

- **Direct** (synchronous): catalog, negotiation status, EDR list, transfer state — all read-only, < 2s
- **Argo** (async): consume-asset (up to 4 min with 3 polling loops) and create-asset (5 sequential steps)
- Both Argo routes return HTTP 202 immediately with a `job_id`
- Client connects to `GET /jobs/{id}/stream` (SSE) for live progress; FastAPI polls Argo every 3s
- The Argo WorkflowTemplate used for each operation is configured per-EDC (`argo_consume_template`, `argo_create_asset_template`) — routers read from `edc.*` directly, never from `settings.*`

### SSE streaming

`sse-starlette` `EventSourceResponse` wraps an async generator in `app/routers/jobs.py`. The generator polls `argo_client.get_workflow_phase()` every 3 seconds, yields `status` events, and on terminal phase yields `done` or `failed` and writes the final status + logs back to the PostgreSQL `jobs` table.

The Ingress must have `nginx.ingress.kubernetes.io/proxy-buffering: "off"` — otherwise nginx buffers SSE events and the stream appears frozen.

### EDC client

`app/services/edc_client.py` uses two internal helpers `_get()` and `_post()` that accept a `consumer: bool` parameter to select between `consumer_url`+`consumer_api_key` and `provider_url`+`provider_api_key`. All calls read the K8s secret fresh on each request (no in-memory caching — add an LRU cache with TTL if latency becomes an issue).

## RBAC bootstrap

`POST /admin/bootstrap` — requires a valid Bearer token (Keycloak login), no permission needed.
Creates an "admin" role with `scope=user, instance=*, operation=manage` and assigns it to the calling user.
Returns 409 if any such permission already exists (self-disabling after first use).

## Conventions

- All Pydantic models use `Field(...)` with `description=` on every field
- ORM models live in `app/db/models.py`; Pydantic schemas live in `app/models/`
- Routers that target a specific EDC use `require_edc_permission(EDCOperation.<X>)` as a FastAPI `Depends` — this automatically reads `edc_id` from the path and issues a single DB query
- No comments in code unless the WHY is non-obvious
- `asyncpg` driver (URL prefix `postgresql+asyncpg://`)
- K8s secret names follow the pattern `edc-{edc_id}-credentials`

## Running locally

```bash
# 1. Start PostgreSQL
docker compose up db -d

# 2. Copy and fill env
cp .env.example .env

# 3. Install + run
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# 4. OpenAPI docs
open http://localhost:8000/docs
```

## Frontend

React 19 + TypeScript + Vite 8 SPA at `frontend/`. Communicates with the backend exclusively via `/api/*` (nginx strips the prefix). Keycloak PKCE login is enforced before React mounts.

### Tech stack

| Layer | Library |
|-------|---------|
| Build | Vite 8, TypeScript 6 |
| UI components | shadcn (Nova preset, radix-ui consolidated package), Tailwind CSS v3, Geist font |
| State — server | TanStack Query v5 |
| State — client | Zustand v4 |
| Routing | React Router v6 |
| Forms | react-hook-form + zod |
| Tables | TanStack Table v8 |
| Auth | keycloak-js v25 (PKCE, `login-required`) |
| SSE streaming | @microsoft/fetch-event-source |
| Toasts | sonner |

### Project layout

```
frontend/src/
  lib/
    keycloak.ts              # Keycloak singleton (reads VITE_KEYCLOAK_* env vars)
    store.ts                 # Zustand: selectedEDCId
    permissions.ts           # buildCan(user) → (scope, instance, op) => boolean
    api/
      client.ts              # axios instance — auto-attaches Bearer token, redirects on 401
      types.ts               # All TypeScript interfaces (EDCResponse, JobResponse, etc.)
      services/
        edcService.ts        # /edcs + /admin/edcs
        jobService.ts        # /jobs
        catalogService.ts    # /edcs/{id}/catalog
        bpnService.ts        # /edcs/{id}/bpn-discovery (fetches all, frontend paginates)
        consumeService.ts    # /edcs/{id}/consume + /edcs/{id}/assets
        adminService.ts      # /admin/users, /admin/roles, /admin/users/me, /admin/bootstrap
  contexts/
    AuthContext.tsx           # Fetches /admin/users/me on mount, provides UserResponse
  hooks/
    useAuth.ts               # { keycloak, user, isLoading, refetch }
    usePermissions.ts        # { can, isAdmin }
    useSSEJob.ts             # Wraps /jobs/{id}/stream SSE via fetchEventSource
  components/
    auth/                    # RequirePermission, ProtectedRoute
    layout/                  # AppShell, Sidebar, Topbar, UserMenu
    edc/                     # EDCCard, EDCDetailHeader
    jobs/                    # JobListPanel, JobRow, JobStatusBadge, JobDetailDrawer,
                             #   JobLogViewer, ArtifactDownloadBar
                             #   (URL-valued output parameters rendered as clickable links)
    bpn/                     # BPNDiscoveryPanel, BPNDiscoveryTable (TanStack Table)
    catalog/                 # CatalogView, OwnCatalogView, CatalogAssetCard, PolicyBadge
    consume/                 # ConsumeWizard (4-step dialog), JobProgressPanel (SSE),
                             #   steps/Step1–4
    assets/                  # CreateAssetForm
    admin/                   # AdminShell, edcs/*, users/*, roles/*
      edcs/
        EDCCreateForm.tsx    # includes argo_consume_template, argo_create_asset_template fields
        EDCEditForm.tsx      # same
        EDCSecretsSection.tsx # includes target_storage_url/user_key/user_secret fields
    ui/                      # shadcn components
  pages/
    EDCDashboardPage.tsx     # Tabs: Jobs | Partner Catalog | Own Catalog | Register Asset
    BootstrapPage.tsx        # /bootstrap — calls POST /admin/bootstrap
    AdminPage.tsx            # Guard wrapper (unused in current routing)
  App.tsx                    # BrowserRouter + lazy-loaded routes
  main.tsx                   # Keycloak.init() → createRoot()
```

### RBAC in the frontend

Permissions are checked with `usePermissions()` → `can(scope, instance, operation)`.

| Permission | Enables |
|-----------|---------|
| `edc:{id}:inspect` | EDC appears in sidebar |
| `edc:{id}:status` | Jobs tab |
| `edc:{id}:catalog` | Own Catalog tab + Catalog View |
| `edc:{id}:bpn-discovery` | Partner Catalog tab (combined with catalog) |
| `edc:{id}:consume` | Consume button in catalog cards |
| `edc:{id}:create_asset` | Register Asset tab |
| `user:*:manage` | Admin link in sidebar + all /admin/* routes |

Wildcards work: `edc:*:consume` grants consume on all EDCs.

### Key design decisions

- **No `.env.local`** — Keycloak vars are injected as container env vars (`VITE_KEYCLOAK_*`) at runtime; Docker Compose substitutes them from the root `.env`
- **`/api` proxy** — Vite proxies `/api/*` → `http://$BACKEND_URL` (strips `/api` prefix); in production nginx does the same. No hardcoded backend URLs in source code.
- **BPN Discovery pagination** — backend has no pagination; frontend fetches up to 10 000 entries, then paginates and filters client-side with TanStack Table
- **SSE job streaming** — `useSSEJob` connects to `/jobs/{id}/stream` and feeds a `useReducer` state machine (idle → connecting → running → succeeded/failed/error)
- **Policy confirmation** — Step 2 of the ConsumeWizard renders one checkbox per ODRL constraint; all must be checked before proceeding. Confirmation is purely UI-side, not sent to the backend.
- **shadcn path alias** — `components.json` is configured with `src/` paths (not `@/`) to avoid the CLI creating an erroneous `@/` top-level directory

### Dev setup (Docker)

```bash
# Start all services in dev mode
docker compose -f docker-compose.yml -f docker-compose.dev.yaml up -d

# Rebuild frontend container after Dockerfile.dev changes
docker compose -f docker-compose.yml -f docker-compose.dev.yaml up -d --build frontend

# Restart frontend only (picks up vite.config.ts changes via volume mount)
docker compose -f docker-compose.yml -f docker-compose.dev.yaml restart frontend
```

- Vite dev server runs on port 5173 inside the container; `nginx.dev.conf` proxies it (with WebSocket upgrade for HMR)
- `nginx.dev.conf` overrides `nginx.conf` via the `nginx` service volume in `docker-compose.dev.yaml`
- `vite.config.ts` sets `server.allowedHosts: true` — required because nginx forwards the external hostname as the `Host` header
- `VITE_KEYCLOAK_*` vars are set in the frontend service environment (not build args) because Vite reads them at runtime in dev mode; build args are only used in the production Dockerfile

### Production Dockerfile

The production `frontend/Dockerfile` (multi-stage) runs `vite build` with `VITE_*` as build args (baked into the JS bundle), then serves the dist via nginx on port 80. The `nginx.conf` at the project root handles routing in production.

## Example scripts

```bash
pip install -e ".[examples]"
cp examples/.env.example examples/.env
cd examples
python 07_full_workflow.py   # end-to-end demo
```

## Environment variables (all required unless noted)

| Variable | Description |
|----------|-------------|
| `EDC_GATEWAY_POSTGRES_USER` | PostgreSQL username |
| `EDC_GATEWAY_POSTGRES_SECRET` | PostgreSQL password |
| `EDC_GATEWAY_POSTGRES_HOST` | PostgreSQL host (default: `localhost`) |
| `EDC_GATEWAY_POSTGRES_PORT` | PostgreSQL port (default: `5432`) |
| `EDC_GATEWAY_POSTGRES_DB` | PostgreSQL database name |
| `SECRET_ENCRYPTION_KEY` | Fernet key for PostgreSQL secret encryption |
| `OIDC_JWKS_URL` | Keycloak JWKS endpoint |
| `OIDC_ISSUER` | Keycloak issuer URL |
| `OIDC_AUDIENCE` | Expected JWT audience (optional) |
| `K8S_NAMESPACE` | Namespace for EDC credential secrets (default: `edc-gateway`) |
| `K8S_IN_CLUSTER` | `true` in K8s, `false` for local dev with kubeconfig |
| `ARGO_SERVER_URL` | Argo server base URL |
| `ARGO_NAMESPACE` | Namespace where Argo workflows run |
| `ARGO_WORKFLOW_SA` | ServiceAccount for workflow pods |
| `ARGO_CONSUME_TEMPLATE` | Fallback WorkflowTemplate name for consume-asset (overridden per-EDC by `argo_consume_template`) |
| `ARGO_CREATE_ASSET_TEMPLATE` | Fallback WorkflowTemplate name for create-asset (overridden per-EDC by `argo_create_asset_template`) |

> **Note**: `ARGO_CONSUME_TEMPLATE` and `ARGO_CREATE_ASSET_TEMPLATE` are no longer read by the routers — each EDC stores its own template name in the database (`argo_consume_template`, `argo_create_asset_template`). These env vars remain in `settings.py` but are effectively unused unless a router explicitly falls back to them.
