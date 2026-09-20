import { api } from 'boot/axios'

// Jedno mjesto za sve pozive na giMMi API (/server).
export const gimmiApi = {
  getHealth: () => api.get('/health').then((res) => res.data),

  login: (email, password) => api.post('/auth/login', { email, password }).then((res) => res.data),

  logout: () => api.post('/auth/logout').then((res) => res.data),

  getCurrentUser: () => api.get('/auth/me').then((res) => res.data),

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

  getMyPurchaseRequests: () =>
    api.get('/purchase-requests', { params: { mine: 1 } }).then((res) => res.data),

  createPurchaseRequest: (payload) =>
    api.post('/purchase-requests', payload).then((res) => res.data),

  changePurchaseRequestStatus: (id, toStatus, comment) =>
    api.post(`/purchase-requests/${id}/transitions`, { toStatus, comment }).then((res) => res.data),

  // prilog ide kao multipart; documentType je kod iz sifrarnika DocumentType
  addAttachment: (id, file, documentType) => {
    const form = new FormData()
    form.append('documentType', documentType)
    form.append('file', file)

    return api.post(`/purchase-requests/${id}/attachments`, form).then((res) => res.data)
  },
}
