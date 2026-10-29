import api from '@/lib/api/client'
import type { BPNDiscoveryEntry } from '@/lib/api/types'

export const bpnService = {
  fetchAll: async (edcId: string): Promise<BPNDiscoveryEntry[]> => {
    const res = await api.post(`/edcs/${edcId}/bpn-discovery`, null, {
      params: { limit: 10000, offset: 0 },
    })
    const data = res.data
    // Backend may return array directly or wrapped object
    if (Array.isArray(data)) return data as BPNDiscoveryEntry[]
    if (data && Array.isArray(data.results)) return data.results as BPNDiscoveryEntry[]
    return []
  },
}
