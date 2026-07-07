import { api } from './api'

export interface AlertItem {
  labels: Record<string, string>
  annotations?: Record<string, string>
  startsAt?: string
  endsAt?: string
  status?: { state: string }
}

export async function fetchAlerts(active = true): Promise<AlertItem[]> {
  const { data } = await api.get<AlertItem[]>('/alerts', { params: { active } })
  return data
}
