import api from '@/lib/api/client'
import type { JobResponse } from '@/lib/api/types'

export const jobService = {
  list: (edcId: string, limit = 20, offset = 0) =>
    api
      .get<JobResponse[]>('/jobs', { params: { edc_id: edcId, limit, offset } })
      .then((r) => r.data),

  get: (jobId: string, edcId: string) =>
    api.get<JobResponse>(`/jobs/${jobId}`, { params: { edc_id: edcId } }).then((r) => r.data),

  getLogs: (jobId: string, edcId: string) =>
    api
      .get<string[]>(`/jobs/${jobId}/logs`, { params: { edc_id: edcId } })
      .then((r) => r.data),

  downloadArtifact: (jobId: string, artifactName: string, edcId: string) =>
    api
      .get(`/jobs/${jobId}/artifacts/${artifactName}`, {
        params: { edc_id: edcId },
        responseType: 'blob',
      })
      .then((r) => r.data as Blob),

  delete: (jobId: string, edcId: string) =>
    api.delete(`/jobs/${jobId}`, { params: { edc_id: edcId } }),

  bulkDelete: (ids: string[], edcId: string) =>
    api.delete('/jobs', { params: { edc_id: edcId }, data: { ids } }),
}
