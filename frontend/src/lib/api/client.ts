import axios from 'axios'
import { keycloak } from '@/lib/keycloak'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(async (config) => {
  try {
    await keycloak.updateToken(30)
  } catch {
    await keycloak.login()
  }
  if (keycloak.token) {
    config.headers.Authorization = `Bearer ${keycloak.token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await keycloak.login()
    }
    return Promise.reject(err)
  },
)

export default api
