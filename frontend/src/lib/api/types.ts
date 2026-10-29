export interface PermissionResponse {
  id: string
  scope: 'edc' | 'user'
  instance: string
  operation: string
}

export interface RoleResponse {
  id: string
  name: string
  description?: string
  permissions: PermissionResponse[]
}

export interface UserResponse {
  id: string
  sub: string
  email?: string
  roles: RoleResponse[]
}

export interface DCATResource {
  uri: string
  title: string | null
  description: string | null
  mimetype: string | null
  download_url: string | null
}

export interface DCATDataset {
  uri: string
  title: string | null
  description: string | null
  organisation: string | null
  author: string | null
  maintainer: string | null
  maintainer_email: string | null
  landing_page: string | null
  resources: DCATResource[]
}

export interface EDCResponse {
  id: string
  display_name: string
  consumer_url: string
  provider_url: string
  base_did: string | null
  provider_bpn: string
  submodel_server_url: string | null
  bpn_discovery_auth_url: string | null
  bpn_discovery_host: string | null
  bpn_discovery_endpoint: string | null
  http_timeout: number
  sse_poll_interval: number
  use_2025_1: boolean
  use_edrs: boolean
  use_bpn: boolean
  contract_negotiation_router: string
  provider_dsp_suffix: string
  argo_consume_template: string
  argo_create_asset_template: string
  argo_delete_asset_template: string
  dcat_catalog_url: string | null
  dcat_sparql_query: string | null
  job_output_parameter_whitelist: string[] | null
  job_artifact_whitelist: string[] | null
  job_asset_artifact_name: string | null
  job_asset_filename_parameter: string | null
  job_asset_content_type_parameter: string | null
  k8s_secret_name: string
}

export interface EDCSecrets {
  consumer_api_key: string
  provider_api_key: string
  client_cert_path?: string | null
  client_cert_password?: string | null
  oauth2_token_url?: string | null
  oauth2_client_id?: string | null
  oauth2_client_secret_key?: string | null
  oauth2_grant_type?: string
  bpn_discovery_client_id?: string | null
  bpn_discovery_client_secret?: string | null
  target_storage_url?: string | null
  target_storage_user_key?: string | null
  target_storage_user_secret?: string | null
  target_storage_owner_org_id?: string | null
}

export interface EDCCreateRequest {
  id: string
  display_name: string
  consumer_url: string
  provider_url: string
  base_did?: string | null
  provider_bpn: string
  submodel_server_url?: string | null
  bpn_discovery_auth_url?: string | null
  bpn_discovery_host?: string | null
  bpn_discovery_endpoint?: string | null
  http_timeout?: number
  sse_poll_interval?: number
  use_2025_1?: boolean
  use_edrs?: boolean
  use_bpn?: boolean
  contract_negotiation_router?: string
  provider_dsp_suffix?: string
  argo_consume_template?: string
  argo_create_asset_template?: string
  argo_delete_asset_template?: string
  dcat_catalog_url?: string | null
  dcat_sparql_query?: string | null
  job_output_parameter_whitelist?: string[] | null
  job_artifact_whitelist?: string[] | null
  job_asset_artifact_name?: string | null
  job_asset_filename_parameter?: string | null
  job_asset_content_type_parameter?: string | null
  secrets: EDCSecrets
}

export type EDCUpdateRequest = Partial<Omit<EDCCreateRequest, 'id'>>

export interface WorkflowParameter {
  name: string
  value?: string | null
}

export interface WorkflowArtifactInfo {
  name: string
}

export interface WorkflowInputs {
  parameters: WorkflowParameter[]
}

export interface WorkflowOutputs {
  parameters: WorkflowParameter[]
  artifacts: WorkflowArtifactInfo[]
  exit_code?: string | null
}

export interface JobResponse {
  id: string
  edc_id: string | null
  operation: 'consume' | 'create_asset' | 'delete_asset'
  argo_workflow_name: string | null
  created_at: string
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Error' | null
  status: 'pending' | 'running' | 'succeeded' | 'failed' | null
  started_at: string | null
  finished_at: string | null
  progress: string | null
  message: string | null
  inputs: WorkflowInputs | null
  outputs: WorkflowOutputs | null
}

export interface ConsumeAssetRequest {
  asset_id: string
  provider_bpn?: string | null
  provider_dsp_url?: string | null
  use_edrs?: boolean | null
  add_membership?: boolean
  debug?: boolean
}

export interface DeleteAssetRequest {
  asset_id: string
  debug?: boolean
}

export interface CreateAssetRequest {
  asset_name: string
  asset_description?: string
  asset_type?: string
  asset_path: string
  asset_subtype?: string | null
  asset_id_short?: string | null
  data_address_base_url?: string | null
  data_address_name?: string | null
  consumer_bpn: string
  full_policy?: boolean
}

export interface BPNDiscoveryEntry {
  bpn: string
  connectorEndpoint: string[]
}

export interface BPNRegistryEntryResponse {
  id: string
  edc_id: string
  bpn: string
  connector_endpoints: string[]
  did: string | null
  dsp_suffix: string | null
}

export interface BPNRegistryEntryCreate {
  bpn: string
  connector_endpoints: string[]
  did?: string | null
  dsp_suffix?: string | null
}

export interface BPNRegistryEntryUpdate {
  connector_endpoints: string[]
  did?: string | null
  dsp_suffix?: string | null
}

export interface PermissionCreate {
  scope: 'edc' | 'user'
  instance: string
  operation: string
}

export interface RoleCreateRequest {
  name: string
  description?: string
  permissions?: PermissionCreate[]
}

export type RoleUpdateRequest = RoleCreateRequest

export interface AssignRolesRequest {
  role_ids: string[]
}

// ODRL / Catalog types
export interface OdrlAction {
  '@id': string
}

export interface OdrlConstraint {
  'odrl:leftOperand': string | { '@id': string }
  'odrl:operator': { '@id': string }
  'odrl:rightOperand': string
}

export interface OdrlConstraintGroup {
  'odrl:and'?: OdrlConstraint[]
  'odrl:or'?: OdrlConstraint[]
}

export interface OdrlPermission {
  'odrl:action': OdrlAction
  'odrl:constraint'?: OdrlConstraint | OdrlConstraintGroup
}

export interface OdrlOffer {
  '@id': string
  '@type': string
  'odrl:permission': OdrlPermission | OdrlPermission[]
  'odrl:prohibition': unknown[]
  'odrl:obligation': unknown[]
}

export interface CatalogDataset {
  '@id': string
  '@type': string
  'odrl:hasPolicy': OdrlOffer | OdrlOffer[]
  name?: string
  description?: string
  id?: string
  contenttype?: string
}

export interface CatalogResponse {
  '@id': string
  '@type': string
  'dcat:dataset': CatalogDataset | CatalogDataset[]
  'dspace:participantId'?: string
}
