import { Lock, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EDCSecretsSectionProps {
  expanded: boolean
  onToggle: () => void
  isEdit?: boolean
}

interface FieldRowProps {
  id: string
  label: string
  required?: boolean
  type?: string
  placeholder?: string
}

function FieldRow({ id, label, required, type = 'text', placeholder }: FieldRowProps) {
  const { register, formState: { errors } } = useFormContext()
  const error = errors[id]

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete="off"
        {...register(id)}
      />
      {error && (
        <p className="text-xs text-destructive">{String(error.message ?? 'Invalid')}</p>
      )}
    </div>
  )
}

export function EDCSecretsSection({ expanded, onToggle, isEdit = false }: EDCSecretsSectionProps) {
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span>Credentials</span>
          {isEdit && !expanded && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              (K8s secret configured)
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t pt-4">
          {isEdit && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                Saving will replace ALL existing secret values in the Kubernetes secret.
              </p>
            </div>
          )}

          <FieldRow
            id="secrets.consumer_api_key"
            label="Consumer API Key"
            required
            type="password"
            placeholder="Consumer EDC API key"
          />

          <FieldRow
            id="secrets.provider_api_key"
            label="Provider API Key"
            required
            type="password"
            placeholder="Provider EDC API key"
          />

          <FieldRow
            id="secrets.oauth2_token_url"
            label="OAuth2 Token URL"
            placeholder="https://..."
          />

          <FieldRow
            id="secrets.oauth2_client_id"
            label="OAuth2 Client ID"
          />

          <FieldRow
            id="secrets.oauth2_client_secret_key"
            label="OAuth2 Client Secret Key"
            type="password"
          />

          <FieldRow
            id="secrets.bpn_discovery_client_id"
            label="BPN Discovery Client ID"
          />

          <FieldRow
            id="secrets.bpn_discovery_client_secret"
            label="BPN Discovery Client Secret"
            type="password"
          />

          <FieldRow
            id="secrets.client_cert_path"
            label="Client Certificate Path"
            placeholder="/path/to/cert.pem"
          />

          <FieldRow
            id="secrets.client_cert_password"
            label="Client Certificate Password"
            type="password"
          />

          <FieldRow
            id="secrets.target_storage_url"
            label="Target Storage URL"
            placeholder="https://ckan.example.com"
          />

          <FieldRow
            id="secrets.target_storage_user_key"
            label="Target Storage User Key"
            type="password"
            placeholder="API token"
          />

          <FieldRow
            id="secrets.target_storage_user_secret"
            label="Target Storage User Secret"
            type="password"
            placeholder="e.g. CKAN owner org ID"
          />

          <FieldRow
            id="secrets.target_storage_owner_org_id"
            label="Target Storage Owner Org ID"
            placeholder="Owner organisation ID (e.g. CKAN owner org)"
          />
        </div>
      )}
    </div>
  )
}

export function EDCSecretsSectionStandalone({
  expanded,
  onToggle,
  isEdit = false,
}: EDCSecretsSectionProps) {
  return (
    <div className="rounded-md border">
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium h-auto rounded-md"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span>Credentials</span>
          {isEdit && !expanded && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              (K8s secret configured)
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {expanded && isEdit && (
        <div className="px-4 pb-2 border-t pt-3">
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">
              Saving will replace ALL existing secret values in the Kubernetes secret.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
