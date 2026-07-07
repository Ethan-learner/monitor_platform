import { api } from './api'

export interface ComponentHealth {
  name: string
  status: 'up' | 'down'
  latencyMs: number | null
}

export interface AlertsSummary {
  critical: number
  warning: number
  info: number
  other: number
  total: number
}

export async function fetchHealth(): Promise<ComponentHealth[]> {
  const { data } = await api.get<ComponentHealth[]>('/overview/health')
  return data
}

export async function fetchAlertsSummary(): Promise<AlertsSummary> {
  const { data } = await api.get<AlertsSummary>('/overview/alerts-summary')
  return data
}
