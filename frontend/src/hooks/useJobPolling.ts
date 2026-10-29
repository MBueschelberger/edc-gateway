import { useEffect, useRef, useState } from 'react'
import { jobService } from '@/lib/api/services/jobService'
import type { JobResponse } from '@/lib/api/types'

const TERMINAL_STATUSES = new Set(['succeeded', 'failed'])
const POLL_INTERVAL_MS = 3000

export function useJobPolling(jobId: string | null, edcId: string) {
  const [job, setJob] = useState<JobResponse | null>(null)
  const [logs, setLogs] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const [prevJobId, setPrevJobId] = useState<string | null>(null)

  if (jobId !== prevJobId) {
    setPrevJobId(jobId)
    setJob(null)
    setLogs(null)
    setError(null)
  }

  useEffect(() => {
    if (!jobId) return

    cancelledRef.current = false

    let timerId: ReturnType<typeof setTimeout>

    const currentJobId = jobId

    async function poll() {
      if (cancelledRef.current) return
      try {
        const data = await jobService.get(currentJobId, edcId)
        if (cancelledRef.current) return
        setJob(data)

        if (data.status && TERMINAL_STATUSES.has(data.status)) {
          try {
            const logLines = await jobService.getLogs(currentJobId, edcId)
            if (!cancelledRef.current) setLogs(logLines)
          } catch {
            if (!cancelledRef.current) setLogs([])
          }
          return
        }

        timerId = setTimeout(poll, POLL_INTERVAL_MS)
      } catch (err) {
        if (!cancelledRef.current) setError(String(err))
      }
    }

    poll()

    return () => {
      cancelledRef.current = true
      clearTimeout(timerId)
    }
  }, [jobId, edcId])

  return { job, logs, error }
}
