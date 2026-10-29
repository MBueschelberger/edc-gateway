import type { OdrlConstraint } from '@/lib/api/types'

interface PolicyBadgeProps {
  constraint: OdrlConstraint
}

function resolveLeftOperand(value: string | { '@id': string }): string {
  const raw = typeof value === 'string' ? value : value['@id']

  const knownMap: Record<string, string> = {
    'https://w3id.org/catenax/2025/9/policy/FrameworkAgreement': 'Framework Agreement',
    'https://w3id.org/catenax/2025/9/policy/UsagePurpose': 'Usage Purpose',
    'https://w3id.org/catenax/2025/9/policy/Membership': 'Membership',
    'cx-policy:FrameworkAgreement': 'Framework Agreement',
    'cx-policy:UsagePurpose': 'Usage Purpose',
  }

  if (knownMap[raw]) return knownMap[raw]

  // Extract after last / or :
  const slashIdx = raw.lastIndexOf('/')
  const colonIdx = raw.lastIndexOf(':')
  const cutIdx = Math.max(slashIdx, colonIdx)
  return cutIdx >= 0 ? raw.slice(cutIdx + 1) : raw
}

function resolveOperator(operatorId: string): string {
  const map: Record<string, string> = {
    'odrl:eq': '=',
    'odrl:isAnyOf': 'is any of',
    'odrl:isNoneOf': 'is none of',
  }
  return map[operatorId] ?? operatorId
}

export function PolicyBadge({ constraint }: PolicyBadgeProps) {
  const left = resolveLeftOperand(constraint['odrl:leftOperand'])
  const operator = resolveOperator(constraint['odrl:operator']['@id'])
  const right = constraint['odrl:rightOperand']

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-foreground dark:bg-blue-900/30 dark:text-blue-300">
      <span>{left}</span>
      <span className="text-blue-700 dark:text-blue-400">{operator}</span>
      <span>{right}</span>
    </span>
  )
}
