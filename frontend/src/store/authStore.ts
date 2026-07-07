import { create } from 'zustand'
import { fetchMe, type PortalUser, login as apiLogin, logout as apiLogout } from '../lib/auth'

interface AuthState {
  user: PortalUser | null
  isAuthenticated: boolean
  loading: boolean
  init: () => Promise<void>
  login: () => void
  logout: () => Promise<void>
  reset: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: () => apiLogin(),
  logout: async () => {
    try {
      await apiLogout()
    } finally {
      set({ user: null, isAuthenticated: false })
    }
  },
  init: async () => {
    set({ loading: true })
    try {
      const user = await fetchMe()
      set({ user, isAuthenticated: true, loading: false })
    } catch {
      set({ user: null, isAuthenticated: false, loading: false })
    }
  },
  reset: () => set({ user: null, isAuthenticated: false, loading: false }),
}))
