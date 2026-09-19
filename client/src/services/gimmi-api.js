import { api } from 'boot/axios'

// Jedno mjesto za sve pozive na giMMi API (/server).
export const gimmiApi = {
  getHealth: () => api.get('/health').then((res) => res.data),

  getFiscalYears: () => api.get('/fiscal-years').then((res) => res.data),

  getDepartments: (params) => api.get('/departments', { params }).then((res) => res.data),

  getItemCategories: (params) => api.get('/item-categories', { params }).then((res) => res.data),

  getRequestStatuses: () => api.get('/request-statuses').then((res) => res.data),

  getUsers: () => api.get('/users').then((res) => res.data),

  getPurchaseRequests: (params) =>
    api.get('/purchase-requests', { params }).then((res) => res.data),

  getPurchaseRequest: (id) => api.get(`/purchase-requests/${id}`).then((res) => res.data),
}
