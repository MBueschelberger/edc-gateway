import api from '@/lib/api/client'
import type { JobResponse, ConsumeAssetRequest, CreateAssetRequest, DeleteAssetRequest, DCATDataset } from '@/lib/api/types'

export const consumeService = {
  consumeAsset: (edcId: string, data: ConsumeAssetRequest) =>
    api.post<JobResponse>(`/edcs/${edcId}/consume`, data).then((r) => r.data),

  createAsset: (edcId: string, data: CreateAssetRequest) =>
    api.post<JobResponse>(`/edcs/${edcId}/assets`, data).then((r) => r.data),

  deleteAsset: (edcId: string, data: DeleteAssetRequest) =>
    api.post<JobResponse>(`/edcs/${edcId}/assets/delete`, data).then((r) => r.data),

  fetchDCATCatalog: (edcId: string) =>
    api.get<DCATDataset[]>(`/edcs/${edcId}/assets/dcat-catalog`).then((r) => r.data),
}
