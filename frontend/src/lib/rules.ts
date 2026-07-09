import { api } from './api'

export interface RuleFile {
  filename: string
  category: string
  size: number
  mtime: number
  content: string
}

export interface ActiveAlert {
  name: string
  severity: string
  instance: string
  job: string
  summary: string
  state: string
  activeAt: string
  category: string
}

export interface ParsedRule {
  name: string
  expr: string
  for: string
  severity: string
  summary: string
  group: string
  file: string
  category: string
  active?: boolean
}

export async function fetchRuleFiles(): Promise<RuleFile[]> {
  const { data } = await api.get<RuleFile[]>('/rules/files')
  return data
}

export async function saveRuleFile(filename: string, content: string): Promise<void> {
  await api.post(`/rules/files/${filename}`, { content })
}

export async function reloadPrometheus(): Promise<void> {
  await api.post('/rules/reload')
}

export async function fetchActiveAlerts(): Promise<ActiveAlert[]> {
  const { data } = await api.get<ActiveAlert[]>('/rules/active')
  return data
}

export async function fetchParsedRules(): Promise<ParsedRule[]> {
  const { data } = await api.get<ParsedRule[]>('/rules/parsed')
  return data
}
