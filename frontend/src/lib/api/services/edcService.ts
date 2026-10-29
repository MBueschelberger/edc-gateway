import api from '@/lib/api/client'
import type {
  BPNRegistryEntryCreate,
  BPNRegistryEntryResponse,
  BPNRegistryEntryUpdate,
  EDCCreateRequest,
  EDCResponse,
  EDCUpdateRequest,
} from '@/lib/api/types'

export const edcService = {
  list: () => api.get<EDCResponse[]>('/edcs').then((r) => r.data),

  get: (id: string) => api.get<EDCResponse>(`/edcs/${id}`).then((r) => r.data),

  adminList: () => api.get<EDCResponse[]>('/admin/edcs').then((r) => r.data),

  adminCreate: (data: EDCCreateRequest) =>
    api.post<EDCResponse>('/admin/edcs', data).then((r) => r.data),

  adminUpdate: (id: string, data: EDCUpdateRequest) =>
    api.patch<EDCResponse>(`/admin/edcs/${id}`, data).then((r) => r.data),

  adminDelete: (id: string) => api.delete(`/admin/edcs/${id}`),

  bpnRegistryList: (edcId: string) =>
    api.get<BPNRegistryEntryResponse[]>(`/admin/edcs/${edcId}/bpn-registry`).then((r) => r.data),

  bpnRegistryCreate: (edcId: string, data: BPNRegistryEntryCreate) =>
    api.post<BPNRegistryEntryResponse>(`/admin/edcs/${edcId}/bpn-registry`, data).then((r) => r.data),

  bpnRegistryUpdate: (edcId: string, entryId: string, data: BPNRegistryEntryUpdate) =>
    api
      .patch<BPNRegistryEntryResponse>(`/admin/edcs/${edcId}/bpn-registry/${entryId}`, data)
      .then((r) => r.data),

  bpnRegistryDelete: (edcId: string, entryId: string) =>
    api.delete(`/admin/edcs/${edcId}/bpn-registry/${entryId}`),
}
