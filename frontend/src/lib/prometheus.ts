import { api } from './api'

export interface PrometheusTarget {
  labels: Record<string, string>
  scrapeUrl: string
  health: 'up' | 'down' | 'unknown'
  lastScrape: string
  lastScrapeDuration: number
  lastError: string
}

export interface TargetResponse {
  data: {
    activeTargets: PrometheusTarget[]
    droppedTargets: PrometheusTarget[]
  }
}

export async function fetchTargets(): Promise<TargetResponse> {
  const { data } = await api.get<TargetResponse>('/prometheus/targets')
  return data
}

export interface PrometheusAlert {
  labels: Record<string, string>
  annotations: Record<string, string>
  state: string
  activeAt: string
  value: string
}

export interface AlertsResponse {
  data: {
    alerts: PrometheusAlert[]
  }
}

export async function fetchPromAlerts(): Promise<AlertsResponse> {
  const { data } = await api.get<AlertsResponse>('/prometheus/alerts')
  return data
}

export interface PromRule {
  name: string
  type: string
  query: string
  health: string
  duration?: number
  labels?: Record<string, string>
  alerts?: PrometheusAlert[]
}

export interface RuleGroup {
  name: string
  file: string
  rules: PromRule[]
  interval?: number
}

export interface RulesResponse {
  data: {
    groups: RuleGroup[]
  }
}

export async function fetchRules(): Promise<RulesResponse> {
  const { data } = await api.get<RulesResponse>('/prometheus/rules')
  return data
}
