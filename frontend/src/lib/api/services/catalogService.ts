import api from '@/lib/api/client'
import type { CatalogResponse } from '@/lib/api/types'

export interface CatalogParams {
  provider_bpn?: string | null
  provider_dsp_url?: string | null
  asset_id?: string | null
}

export function extractEdcErrorMessage(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const first = value[0] as Record<string, unknown>
  if (typeof first?.message === 'string') return first.message
  return null
}

export const catalogService = {
  fetch: (edcId: string, params: CatalogParams = {}) => {
    const query: Record<string, string> = {}
    if (params.provider_bpn) query.provider_bpn = params.provider_bpn
    if (params.provider_dsp_url) query.provider_dsp_url = params.provider_dsp_url
    if (params.asset_id) query.asset_id = params.asset_id
    return api
      .post<CatalogResponse>(`/edcs/${edcId}/catalog`, null, { params: query })
      .then((r) => r.data)
  },
}
