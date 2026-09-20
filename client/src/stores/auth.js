import { defineStore, acceptHMRUpdate } from 'pinia'

import { gimmiApi } from 'src/services/gimmi-api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    // dok ne provjerimo kolacic kod servera, ne znamo je li korisnik prijavljen
    checked: false,
  }),

  getters: {
    isLoggedIn: (state) => state.user !== null,
    fullName: (state) => (state.user ? `${state.user.first_name} ${state.user.last_name}` : ''),
    roleCode: (state) => state.user?.role_code ?? null,
    isAdmin: (state) => state.user?.role_code === 'ADMIN',
  },

  actions: {
    async login(email, password) {
      this.user = await gimmiApi.login(email, password)
      this.checked = true
      return this.user
    },

    async logout() {
      await gimmiApi.logout()
      this.user = null
    },

    // Poziva se prije prve navigacije; 401 znaci da korisnik nije prijavljen
    // i to nije greska.
    async loadCurrentUser() {
      if (this.checked) {
        return this.user
      }

      try {
        this.user = await gimmiApi.getCurrentUser()
      } catch {
        this.user = null
      } finally {
        this.checked = true
      }

      return this.user
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
