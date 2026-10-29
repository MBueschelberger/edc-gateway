import { useState } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { edcService } from '@/lib/api/services/edcService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EDCSecretsSection } from '@/components/admin/edcs/EDCSecretsSection'

const schema = z.object({
  display_name: z.string().min(1, 'Display name is required'),
  consumer_url: z.string().url('Must be a valid URL'),
  provider_url: z.string().url('Must be a valid URL'),
  base_did: z.string().optional().nullable(),
  provider_bpn: z.string().min(1, 'Provider BPN is required'),
  submodel_server_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
  bpn_discovery_auth_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
  bpn_discovery_host: z.string().optional().nullable(),
  bpn_discovery_endpoint: z.string().optional().nullable(),
  http_timeout: z.coerce.number().int().positive().optional(),
  sse_poll_interval: z.coerce.number().int().positive().optional(),
  use_2025_1: z.boolean().optional(),
  use_edrs: z.boolean().optional(),
  use_bpn: z.boolean().optional(),
  contract_negotiation_router: z.string().optional(),
  provider_dsp_suffix: z.string().optional(),
  argo_consume_template: z.string().min(1, 'Required').optional(),
  argo_create_asset_template: z.string().min(1, 'Required').optional(),
  argo_delete_asset_template: z.string().min(1, 'Required').optional(),
  dcat_catalog_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
  dcat_sparql_query: z.string().optional().nullable(),
  job_output_parameter_whitelist: z.string().optional().nullable(),
  job_artifact_whitelist: z.string().optional().nullable(),
  job_asset_artifact_name: z.string().optional().nullable(),
  job_asset_filename_parameter: z.string().optional().nullable(),
  job_asset_content_type_parameter: z.string().optional().nullable(),
  secrets: z.object({
    consumer_api_key: z.string().optional(),
    provider_api_key: z.string().optional(),
    client_cert_path: z.string().optional().nullable(),
    client_cert_password: z.string().optional().nullable(),
    oauth2_token_url: z.string().optional().nullable(),
    oauth2_client_id: z.string().optional().nullable(),
    oauth2_client_secret_key: z.string().optional().nullable(),
    bpn_discovery_client_id: z.string().optional().nullable(),
    bpn_discovery_client_secret: z.string().optional().nullable(),
    target_storage_url: z.string().optional().nullable(),
    target_storage_user_key: z.string().optional().nullable(),
    target_storage_user_secret: z.string().optional().nullable(),
    target_storage_owner_org_id: z.string().optional().nullable(),
  }).optional(),
})

type FormValues = z.infer<typeof schema>

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  )
}

interface FieldProps {
  id: string
  label: string
  required?: boolean
  placeholder?: string
  type?: string
  error?: string
  registration: ReturnType<ReturnType<typeof useForm>['register']>
}

function Field({ id, label, required, placeholder, type = 'text', error, registration }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input id={id} type={type} placeholder={placeholder} {...registration} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function EDCEditForm() {
  "use no memo"
  const navigate = useNavigate()
  const { edcId } = useParams<{ edcId: string }>()
  const queryClient = useQueryClient()
  const [secretsExpanded, setSecretsExpanded] = useState(false)

  const { data: edc, isLoading, isError } = useQuery({
    queryKey: ['admin', 'edcs', edcId],
    queryFn: () => edcService.adminList().then((list) => list.find((e) => e.id === edcId) ?? null),
    enabled: !!edcId,
  })

  const methods = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: edc
      ? {
          display_name: edc.display_name,
          consumer_url: edc.consumer_url,
          provider_url: edc.provider_url,
          base_did: edc.base_did,
          provider_bpn: edc.provider_bpn,
          submodel_server_url: edc.submodel_server_url ?? '',
          bpn_discovery_auth_url: edc.bpn_discovery_auth_url ?? '',
          bpn_discovery_host: edc.bpn_discovery_host,
          bpn_discovery_endpoint: edc.bpn_discovery_endpoint,
          http_timeout: edc.http_timeout,
          sse_poll_interval: edc.sse_poll_interval,
          use_2025_1: edc.use_2025_1,
          use_edrs: edc.use_edrs,
          use_bpn: edc.use_bpn,
          contract_negotiation_router: edc.contract_negotiation_router,
          provider_dsp_suffix: edc.provider_dsp_suffix,
          argo_consume_template: edc.argo_consume_template,
          argo_create_asset_template: edc.argo_create_asset_template,
          argo_delete_asset_template: edc.argo_delete_asset_template,
          dcat_catalog_url: edc.dcat_catalog_url ?? '',
          dcat_sparql_query: edc.dcat_sparql_query ?? '',
          job_output_parameter_whitelist: edc.job_output_parameter_whitelist?.join(', ') ?? '',
          job_artifact_whitelist: edc.job_artifact_whitelist?.join(', ') ?? '',
          job_asset_artifact_name: edc.job_asset_artifact_name ?? '',
          job_asset_filename_parameter: edc.job_asset_filename_parameter ?? '',
          job_asset_content_type_parameter: edc.job_asset_content_type_parameter ?? '',
          secrets: {},
        }
      : undefined,
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = methods

  const use2025_1 = watch('use_2025_1')
  const useEdrs = watch('use_edrs')
  const useBpn = watch('use_bpn')

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const secretsPayload = secretsExpanded && data.secrets ? {
        secrets: {
          consumer_api_key: data.secrets.consumer_api_key ?? '',
          provider_api_key: data.secrets.provider_api_key ?? '',
          client_cert_path: data.secrets.client_cert_path || null,
          client_cert_password: data.secrets.client_cert_password || null,
          oauth2_token_url: data.secrets.oauth2_token_url || null,
          oauth2_client_id: data.secrets.oauth2_client_id || null,
          oauth2_client_secret_key: data.secrets.oauth2_client_secret_key || null,
          bpn_discovery_client_id: data.secrets.bpn_discovery_client_id || null,
          bpn_discovery_client_secret: data.secrets.bpn_discovery_client_secret || null,
          target_storage_url: data.secrets.target_storage_url || null,
          target_storage_user_key: data.secrets.target_storage_user_key || null,
          target_storage_user_secret: data.secrets.target_storage_user_secret || null,
          target_storage_owner_org_id: data.secrets.target_storage_owner_org_id || null,
        },
      } : {}

      return edcService.adminUpdate(edcId!, {
        display_name: data.display_name,
        consumer_url: data.consumer_url,
        provider_url: data.provider_url,
        base_did: data.base_did || null,
        provider_bpn: data.provider_bpn,
        submodel_server_url: data.submodel_server_url || null,
        bpn_discovery_auth_url: data.bpn_discovery_auth_url || null,
        bpn_discovery_host: data.bpn_discovery_host || null,
        bpn_discovery_endpoint: data.bpn_discovery_endpoint || null,
        http_timeout: data.http_timeout,
        sse_poll_interval: data.sse_poll_interval,
        use_2025_1: data.use_2025_1,
        use_edrs: data.use_edrs,
        use_bpn: data.use_bpn,
        contract_negotiation_router: data.contract_negotiation_router,
        provider_dsp_suffix: data.provider_dsp_suffix,
        argo_consume_template: data.argo_consume_template,
        argo_create_asset_template: data.argo_create_asset_template,
        argo_delete_asset_template: data.argo_delete_asset_template,
        dcat_catalog_url: data.dcat_catalog_url || null,
        dcat_sparql_query: data.dcat_sparql_query || null,
        job_output_parameter_whitelist: data.job_output_parameter_whitelist
          ? data.job_output_parameter_whitelist.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        job_artifact_whitelist: data.job_artifact_whitelist
          ? data.job_artifact_whitelist.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        job_asset_artifact_name: data.job_asset_artifact_name || null,
        job_asset_filename_parameter: data.job_asset_filename_parameter || null,
        job_asset_content_type_parameter: data.job_asset_content_type_parameter || null,
        ...secretsPayload,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'edcs'] })
      toast.success('EDC updated successfully')
      navigate('/admin/edcs')
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to update EDC'
      toast.error(message)
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (isError || !edc) {
    return <p className="text-sm text-destructive">Failed to load EDC.</p>
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="flex flex-col gap-6 max-w-2xl"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Edit EDC: {edc.id}</h1>
        </div>

        <div className="flex flex-col gap-4">
          <SectionTitle>Basic Info</SectionTitle>
          <Field
            id="display_name"
            label="Display Name"
            required
            error={errors.display_name?.message}
            registration={register('display_name')}
          />
          <Field
            id="provider_bpn"
            label="Provider BPN"
            required
            placeholder="BPNL000000000000"
            error={errors.provider_bpn?.message}
            registration={register('provider_bpn')}
          />
          <Field
            id="base_did"
            label="Base DID"
            placeholder="did:web:example.com"
            registration={register('base_did')}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <SectionTitle>URLs</SectionTitle>
          <Field
            id="consumer_url"
            label="Consumer URL"
            required
            error={errors.consumer_url?.message}
            registration={register('consumer_url')}
          />
          <Field
            id="provider_url"
            label="Provider URL"
            required
            error={errors.provider_url?.message}
            registration={register('provider_url')}
          />
          <Field
            id="submodel_server_url"
            label="Submodel Server URL"
            placeholder="https://submodel.example.com"
            error={errors.submodel_server_url?.message}
            registration={register('submodel_server_url')}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <SectionTitle>BPN Discovery</SectionTitle>
          <Field
            id="bpn_discovery_auth_url"
            label="BPN Discovery Auth URL"
            placeholder="https://..."
            error={errors.bpn_discovery_auth_url?.message}
            registration={register('bpn_discovery_auth_url')}
          />
          <Field
            id="bpn_discovery_host"
            label="BPN Discovery Host"
            registration={register('bpn_discovery_host')}
          />
          <Field
            id="bpn_discovery_endpoint"
            label="BPN Discovery Endpoint"
            registration={register('bpn_discovery_endpoint')}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <SectionTitle>Advanced</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="http_timeout"
              label="HTTP Timeout (s)"
              type="number"
              error={errors.http_timeout?.message}
              registration={register('http_timeout')}
            />
            <Field
              id="sse_poll_interval"
              label="SSE Poll Interval (s)"
              type="number"
              error={errors.sse_poll_interval?.message}
              registration={register('sse_poll_interval')}
            />
          </div>
          <Field
            id="contract_negotiation_router"
            label="Contract Negotiation Router"
            registration={register('contract_negotiation_router')}
          />
          <Field
            id="provider_dsp_suffix"
            label="Provider DSP Suffix"
            registration={register('provider_dsp_suffix')}
          />
          <Field
            id="argo_consume_template"
            label="Argo Consume Template"
            placeholder="consume-asset"
            error={errors.argo_consume_template?.message}
            registration={register('argo_consume_template')}
          />
          <Field
            id="argo_create_asset_template"
            label="Argo Create Asset Template"
            placeholder="create-asset"
            error={errors.argo_create_asset_template?.message}
            registration={register('argo_create_asset_template')}
          />
          <Field
            id="argo_delete_asset_template"
            label="Argo Delete Asset Template"
            placeholder="delete-asset"
            error={errors.argo_delete_asset_template?.message}
            registration={register('argo_delete_asset_template')}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="use_2025_1"
                checked={use2025_1}
                onCheckedChange={(v) => setValue('use_2025_1', v === true)}
              />
              <Label htmlFor="use_2025_1" className="cursor-pointer">Use DSP 2025-1</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="use_edrs"
                checked={useEdrs}
                onCheckedChange={(v) => setValue('use_edrs', v === true)}
              />
              <Label htmlFor="use_edrs" className="cursor-pointer">Use EDRs</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="use_bpn"
                checked={useBpn}
                onCheckedChange={(v) => setValue('use_bpn', v === true)}
              />
              <Label htmlFor="use_bpn" className="cursor-pointer">Use BPN</Label>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <SectionTitle>DCAT Catalog Discovery</SectionTitle>
          <p className="text-xs text-muted-foreground -mt-2">
            When set, the Register Asset tab will discover unregistered datasets from this DCAT catalog instead of showing a blank form.
          </p>
          <Field
            id="dcat_catalog_url"
            label="DCAT Catalog URL"
            placeholder="https://example.com/catalog.ttl"
            error={errors.dcat_catalog_url?.message}
            registration={register('dcat_catalog_url')}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dcat_sparql_query">DCAT SPARQL Query</Label>
            <Textarea
              id="dcat_sparql_query"
              {...register('dcat_sparql_query')}
              rows={8}
              className="font-mono text-xs"
              placeholder="PREFIX dcat: ..."
            />
            <p className="text-xs text-muted-foreground">
              Must SELECT: ?dataset ?dataset_title ?dataset_description ?organization ?author ?maintainer ?resource ?resource_title ?resource_description ?mimetype ?download_url
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <SectionTitle>Job Output Filtering</SectionTitle>
          <p className="text-xs text-muted-foreground -mt-2">
            Controls which Argo output parameters and artifacts are exposed in job responses. Leave blank to expose all.
          </p>
          <Field
            id="job_asset_artifact_name"
            label="Asset Artifact Name"
            placeholder="asset-data"
            registration={register('job_asset_artifact_name')}
          />
          <Field
            id="job_asset_filename_parameter"
            label="Asset Filename Parameter"
            placeholder="output_filename"
            registration={register('job_asset_filename_parameter')}
          />
          <Field
            id="job_asset_content_type_parameter"
            label="Asset Content Type Parameter"
            placeholder="content_type"
            registration={register('job_asset_content_type_parameter')}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job_artifact_whitelist">Artifact Whitelist</Label>
            <Input
              id="job_artifact_whitelist"
              placeholder="asset-data"
              {...register('job_artifact_whitelist')}
            />
            <p className="text-xs text-muted-foreground">Comma-separated artifact names to expose</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job_output_parameter_whitelist">Output Parameter Whitelist</Label>
            <Input
              id="job_output_parameter_whitelist"
              placeholder="leave blank to expose all"
              {...register('job_output_parameter_whitelist')}
            />
            <p className="text-xs text-muted-foreground">Comma-separated parameter names to expose; blank = all</p>
          </div>
        </div>

        <Separator />

        <EDCSecretsSection
          expanded={secretsExpanded}
          onToggle={() => setSecretsExpanded((v) => !v)}
          isEdit={true}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/edcs')}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
