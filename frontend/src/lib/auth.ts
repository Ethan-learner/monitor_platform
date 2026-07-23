import { api } from './api'

export interface PortalUser {
  username: string
  role: 'ops' | 'dev' | 'mgmt'
  displayName: string
  permissions?: string[]
}

const isDev = !!(import.meta as any).env?.DEV

export async function login() {
  window.location.href = isDev ? '/monitor_platform/api/auth/dev-login?username=admin' : '/monitor_platform/api/auth/login'
}

export async function fetchMe(): Promise<PortalUser> {
  const { data } = await api.get<PortalUser>('/auth/me')
  return data
}

export async function logout() {
  await api.post('/auth/logout')
}
