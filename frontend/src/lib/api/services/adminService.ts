import api from '@/lib/api/client'
import type {
  UserResponse,
  RoleResponse,
  RoleCreateRequest,
  RoleUpdateRequest,
  AssignRolesRequest,
} from '@/lib/api/types'

export const adminService = {
  getMe: () => api.get<UserResponse>('/admin/users/me').then((r) => r.data),

  listUsers: () => api.get<UserResponse[]>('/admin/users').then((r) => r.data),

  getUser: (id: string) => api.get<UserResponse>(`/admin/users/${id}`).then((r) => r.data),

  assignRoles: (userId: string, data: AssignRolesRequest) =>
    api.put<UserResponse>(`/admin/users/${userId}/roles`, data).then((r) => r.data),

  listRoles: () => api.get<RoleResponse[]>('/admin/roles').then((r) => r.data),

  createRole: (data: RoleCreateRequest) =>
    api.post<RoleResponse>('/admin/roles', data).then((r) => r.data),

  updateRole: (id: string, data: RoleUpdateRequest) =>
    api.put<RoleResponse>(`/admin/roles/${id}`, data).then((r) => r.data),

  deleteRole: (id: string) => api.delete(`/admin/roles/${id}`),

  getPermissionOptions: () =>
    api.get<Record<string, string[]>>('/admin/permission-options').then((r) => r.data),

  bootstrap: () => api.post<UserResponse>('/admin/bootstrap').then((r) => r.data),
}
