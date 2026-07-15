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

export async function saveRuleFile(filename: string, content: string, extra: Record<string, any> = {}): Promise<void> {
  await api.post(`/rules/files/${filename}`, { content, ...extra })
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

export interface Silence {
  id: string
  createdBy: string
  comment: string
  startsAt: string
  endsAt: string
  matchers?: Array<{ name: string; value: string; isRegex: boolean }>
  matcherName?: string
  matcherValue?: string
  db_status?: number
}

export async function fetchSilences(): Promise<Silence[]> {
  const { data } = await api.get<Silence[]>('/alerts/silences')
  return data
}

export async function expireSilence(id: string): Promise<void> {
  await api.delete(`/alerts/silences/${id}`)
}

export async function createSilence(body: {
  matchers: Array<{ name: string; value: string; isRegex: boolean }>
  startsAt: string
  endsAt: string
  createdBy: string
  comment: string
}): Promise<{ silenceID: string }> {
  const { data } = await api.post('/alerts/silences', body)
  return data
}

export async function updateSilence(id: string, body: {
  matchers: Array<{ name: string; value: string; isRegex: boolean }>
  startsAt: string
  endsAt: string
  createdBy: string
  comment: string
}): Promise<{ new_sid: string }> {
  const { data } = await api.put(`/alerts/silences/${id}`, body)
  return data
}

export async function deleteSilence(id: string): Promise<void> {
  await api.post(`/alerts/silences/${id}/delete`)
}
