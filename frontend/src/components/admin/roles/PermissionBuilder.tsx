import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import type { PermissionCreate } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const EDC_OPERATIONS = [
  'manage',
  'consume',
  'create_asset',
  'catalog',
  'status',
  'bpn-discovery',
  'inspect',
] as const

const USER_OPERATIONS = ['manage'] as const

interface PermissionBuilderProps {
  permissions: PermissionCreate[]
  onChange: (perms: PermissionCreate[]) => void
  edcOptions: { id: string; display_name: string }[]
}

interface DraftPermission {
  scope: 'edc' | 'user'
  instance: string
  operation: string
}

const EMPTY_DRAFT: DraftPermission = {
  scope: 'edc',
  instance: '*',
  operation: 'consume',
}

export function PermissionBuilder({ permissions, onChange, edcOptions }: PermissionBuilderProps) {
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<DraftPermission>(EMPTY_DRAFT)

  function handleScopeChange(scope: 'edc' | 'user') {
    setDraft({
      scope,
      instance: '*',
      operation: scope === 'edc' ? 'consume' : 'manage',
    })
  }

  function handleAdd() {
    if (!draft.operation) return
    onChange([...permissions, { scope: draft.scope, instance: draft.instance, operation: draft.operation }])
    setDraft(EMPTY_DRAFT)
    setShowForm(false)
  }

  function handleRemove(index: number) {
    onChange(permissions.filter((_, i) => i !== index))
  }

  const operations = draft.scope === 'edc' ? EDC_OPERATIONS : USER_OPERATIONS

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Permissions</Label>
        {!showForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Permission
          </Button>
        )}
      </div>

      {permissions.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">No permissions added.</p>
      )}

      {permissions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {permissions.map((perm, i) => (
            <div key={i} className="flex items-center gap-1">
              <Badge variant="secondary" className="font-mono text-xs">
                {perm.scope}:{perm.instance}:{perm.operation}
              </Badge>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Remove permission"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="rounded-md border p-3 flex flex-col gap-3 bg-muted/30">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Scope</Label>
              <Select
                value={draft.scope}
                onValueChange={(v) => handleScopeChange(v as 'edc' | 'user')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edc">edc</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Instance</Label>
              {draft.scope === 'user' ? (
                <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                  *
                </div>
              ) : (
                <Select
                  value={draft.instance}
                  onValueChange={(v) => setDraft((d) => ({ ...d, instance: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="*">* (all)</SelectItem>
                    {edcOptions.map((edc) => (
                      <SelectItem key={edc.id} value={edc.id}>
                        {edc.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Operation</Label>
              <Select
                value={draft.operation}
                onValueChange={(v) => setDraft((d) => ({ ...d, operation: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operations.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false)
                setDraft(EMPTY_DRAFT)
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleAdd}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
