import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agendi-production.up.railway.app'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('ADMIN_TOKEN')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ADMIN_TOKEN')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (phone, password) =>
  api.post('/auth/login', { phone, password })

// Tenants (super admin)
export const listTenants = () =>
  api.get('/superadmin/tenants')

export const getTenant = (id) =>
  api.get(`/superadmin/tenants/${id}`)

export const createTenant = (data) =>
  api.post('/superadmin/tenants', data)

export const updateTenant = (id, data) =>
  api.put(`/superadmin/tenants/${id}`, data)

export const setTenantActive = (id, active) =>
  api.patch(`/superadmin/tenants/${id}/active`, { active })

export const resetTenantPassword = (id) =>
  api.post(`/superadmin/tenants/${id}/reset-password`)

export default api
