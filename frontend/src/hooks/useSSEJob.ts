import { useEffect, useReducer } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { keycloak } from '@/lib/keycloak'

type SSEStatus = 'idle' | 'connecting' | 'running' | 'succeeded' | 'failed' | 'error'

interface SSEState {
  status: SSEStatus
  phase: string | null
  logs: string[]
  errorMessage: string | null
}

type SSEAction =
  | { type: 'STATUS'; phase: string; status: string }
  | { type: 'LOG'; line: string }
  | { type: 'DONE' }
  | { type: 'FAILED'; phase?: string }
  | { type: 'ERROR'; message: string }
  | { type: 'CONNECTING' }
  | { type: 'RESET' }

function sseReducer(state: SSEState, action: SSEAction): SSEState {
  switch (action.type) {
    case 'CONNECTING':
      return { ...state, status: 'connecting', logs: [], errorMessage: null }
    case 'STATUS':
      return { ...state, status: 'running', phase: action.phase }
    case 'LOG':
      return { ...state, logs: [...state.logs, action.line] }
    case 'DONE':
      return { ...state, status: 'succeeded' }
    case 'FAILED':
      return { ...state, status: 'failed', phase: action.phase ?? state.phase }
    case 'ERROR':
      return { ...state, status: 'error', errorMessage: action.message }
    case 'RESET':
      return { status: 'idle', phase: null, logs: [], errorMessage: null }
    default:
      return state
  }
}

const initialState: SSEState = { status: 'idle', phase: null, logs: [], errorMessage: null }

export function useSSEJob(jobId: string | null, edcId: string) {
  const [state, dispatch] = useReducer(sseReducer, initialState)

  useEffect(() => {
    if (!jobId) {
      dispatch({ type: 'RESET' })
      return
    }

    dispatch({ type: 'CONNECTING' })
    const ctrl = new AbortController()

    fetchEventSource(`/api/jobs/${jobId}/stream?edc_id=${encodeURIComponent(edcId)}`, {
      headers: { Authorization: `Bearer ${keycloak.token ?? ''}` },
      signal: ctrl.signal,
      onmessage(ev) {
        try {
          const data = JSON.parse(ev.data) as Record<string, string>
          switch (ev.event) {
            case 'status':
              dispatch({ type: 'STATUS', phase: data.phase ?? '', status: data.status ?? '' })
              break
            case 'log':
              dispatch({ type: 'LOG', line: data.line ?? ev.data })
              break
            case 'done':
              dispatch({ type: 'DONE' })
              ctrl.abort()
              break
            case 'failed':
              dispatch({ type: 'FAILED', phase: data.phase })
              ctrl.abort()
              break
            case 'error':
              dispatch({ type: 'ERROR', message: data.message ?? 'Unknown error' })
              ctrl.abort()
              break
          }
        } catch {
          dispatch({ type: 'LOG', line: ev.data })
        }
      },
      onerror(err) {
        dispatch({ type: 'ERROR', message: String(err) })
        ctrl.abort()
        throw err // stops fetchEventSource from retrying
      },
    })

    return () => ctrl.abort()
  }, [jobId, edcId])

  return state
}
