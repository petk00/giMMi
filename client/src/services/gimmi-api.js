import { api } from 'boot/axios'

// Jedno mjesto za sve pozive na giMMi API (/server).
export const gimmiApi = {
  getHealth: () => api.get('/health').then((res) => res.data),

  getFiscalYears: () => api.get('/fiscal-years').then((res) => res.data),

  getDepartmentBudgets: (params) =>
    api.get('/department-budgets', { params }).then((res) => res.data),

  getItemCategoryBudgets: (params) =>
    api.get('/item-category-budgets', { params }).then((res) => res.data),

  getPurchaseRequestStatuses: () => api.get('/purchase-request-statuses').then((res) => res.data),

  getUsers: () => api.get('/users').then((res) => res.data),

  getPurchaseRequests: (params) =>
    api.get('/purchase-requests', { params }).then((res) => res.data),

  getPurchaseRequest: (id) => api.get(`/purchase-requests/${id}`).then((res) => res.data),
}
