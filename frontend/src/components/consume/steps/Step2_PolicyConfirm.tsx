import { useState } from 'react'
import type { CatalogDataset, OdrlConstraint, OdrlOffer, OdrlPermission } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { PolicyBadge } from '@/components/catalog/PolicyBadge'

interface Step2PolicyConfirmProps {
  dataset: CatalogDataset
  onNext: () => void
  onBack: () => void
}

function extractAllConstraints(dataset: CatalogDataset): OdrlConstraint[] {
  const policies = Array.isArray(dataset['odrl:hasPolicy'])
    ? dataset['odrl:hasPolicy']
    : [dataset['odrl:hasPolicy']]

  const constraints: OdrlConstraint[] = []

  for (const offer of policies) {
    if (!offer) continue
    const permissions = Array.isArray((offer as OdrlOffer)['odrl:permission'])
      ? ((offer as OdrlOffer)['odrl:permission'] as OdrlPermission[])
      : [(offer as OdrlOffer)['odrl:permission'] as OdrlPermission]

    for (const perm of permissions) {
      if (!perm) continue
      const raw = perm['odrl:constraint']
      if (!raw) continue

      if ('odrl:leftOperand' in raw) {
        constraints.push(raw as OdrlConstraint)
        continue
      }

      if ('odrl:and' in raw && Array.isArray((raw as { 'odrl:and': OdrlConstraint[] })['odrl:and'])) {
        constraints.push(...(raw as { 'odrl:and': OdrlConstraint[] })['odrl:and'])
        continue
      }

      if ('odrl:or' in raw && Array.isArray((raw as { 'odrl:or': OdrlConstraint[] })['odrl:or'])) {
        constraints.push(...(raw as { 'odrl:or': OdrlConstraint[] })['odrl:or'])
      }
    }
  }

  return constraints
}

function constraintLabel(constraint: OdrlConstraint): string {
  const left = constraint['odrl:leftOperand']
  const leftStr = typeof left === 'string' ? left : left['@id']
  const operator = constraint['odrl:operator']['@id']
  const right = constraint['odrl:rightOperand']

  const operatorMap: Record<string, string> = {
    'odrl:eq': 'equals',
    'odrl:isAnyOf': 'is any of',
    'odrl:isNoneOf': 'is none of',
  }

  const opLabel = operatorMap[operator] ?? operator

  // Extract readable name from URL
  const slashIdx = leftStr.lastIndexOf('/')
  const colonIdx = leftStr.lastIndexOf(':')
  const cutIdx = Math.max(slashIdx, colonIdx)
  const leftLabel = cutIdx >= 0 ? leftStr.slice(cutIdx + 1) : leftStr

  return `I accept the "${leftLabel} ${opLabel} ${right}" constraint`
}

export function Step2PolicyConfirm({ dataset, onNext, onBack }: Step2PolicyConfirmProps) {
  const constraints = extractAllConstraints(dataset)
  const [checked, setChecked] = useState<boolean[]>(() => constraints.map(() => false))

  const allChecked = checked.every(Boolean)

  function toggle(idx: number) {
    setChecked((prev) => {
      const next = [...prev]
      next[idx] = !next[idx]
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {constraints.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No policy constraints found for this asset.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {constraints.map((constraint, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <Checkbox
                id={`constraint-${idx}`}
                checked={checked[idx] ?? false}
                onCheckedChange={() => toggle(idx)}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`constraint-${idx}`}
                  className="text-sm leading-snug cursor-pointer"
                >
                  {constraintLabel(constraint)}
                </Label>
                <PolicyBadge constraint={constraint} />
              </div>
            </div>
          ))}
        </div>
      )}

      {constraints.length > 0 && (
        <p className="text-xs text-amber-800 bg-amber-100 rounded px-3 py-2 dark:bg-amber-900/30 dark:text-amber-400">
          By checking these boxes, you confirm you accept the usage policy terms.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={constraints.length > 0 && !allChecked}
        >
          Confirm &amp; Continue
        </Button>
      </div>
    </div>
  )
}
