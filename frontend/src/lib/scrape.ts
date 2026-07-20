import { api } from './api'

export interface ScrapeTarget {
  id: number
  department: string
  category: string
  target: string
  labels: Record<string, string>
  status: 1 | 0 | -1
  description: string
  operator: string
  createdAt: string
}

export interface DirectoryItem {
  id: number
  name: string
  category: string
  label: string
  description: string
  owner: string
  enabled: number
  createdAt: string
}

export async function fetchTargets(): Promise<ScrapeTarget[]> {
  const { data } = await api.get<ScrapeTarget[]>('/scrape/targets')
  return data || []
}

export async function fetchDirectories(): Promise<DirectoryItem[]> {
  const { data } = await api.get<DirectoryItem[]>('/scrape/directories')
  return data || []
}

export async function createDirectory(data: { name: string; category?: string; description: string }): Promise<{ id: number }> {
  const { data: res } = await api.post('/scrape/directories', data)
  return res
}

export async function deleteDirectory(id: number): Promise<void> {
  await api.delete(`/scrape/directories/${id}`)
}

export async function deleteFile(dept: string, cat: string): Promise<void> {
  await api.delete(`/scrape/file/${encodeURIComponent(dept)}/${encodeURIComponent(cat)}`)
}

export async function updateDirectory(id: number, data: { description: string }): Promise<void> {
  await api.put(`/scrape/directories/${id}`, data)
}

export async function createTarget(data: {
  department: string
  category: string
  target: string
  labels: string
  description: string
}): Promise<{ id: number }> {
  const labelsObj: Record<string, string> = {}
  if (data.labels) {
    data.labels.split('\n').forEach((line) => {
      const [k, ...v] = line.split('=')
      if (k && v.length) labelsObj[k.trim()] = v.join('=').trim()
    })
  }
  const { data: res } = await api.post('/scrape/targets', {
    department: data.department,
    category: data.category,
    target: data.target,
    labels: labelsObj,
    description: data.description,
  })
  return res
}

export async function updateTarget(id: number, data: {
  target?: string
  labels?: string
  description?: string
}): Promise<void> {
  const body: any = {}
  if (data.target !== undefined) body.target = data.target
  if (data.labels !== undefined) {
    const labelsObj: Record<string, string> = {}
    data.labels.split('\n').forEach((line) => {
      const [k, ...v] = line.split('=')
      if (k && v.length) labelsObj[k.trim()] = v.join('=').trim()
    })
    body.labels = labelsObj
  }
  if (data.description !== undefined) body.description = data.description
  await api.put(`/scrape/targets/${id}`, body)
}

export async function deleteTarget(id: number): Promise<void> {
  await api.delete(`/scrape/targets/${id}`)
}

export async function toggleTarget(id: number): Promise<void> {
  await api.post(`/scrape/targets/${id}/toggle`)
}

export async function syncFromServer(): Promise<{ synced: number }> {
  const { data } = await api.post('/scrape/sync')
  return data
}

export interface TargetHealth {
  id: number
  department: string
  category: string
  target: string
  health: 'effective' | 'ineffective' | 'invalid'
  prometheusHealth: 'up' | 'down' | 'unknown' | null
  lastScrape: string | null
  lastError: string | null
  lastCheckAt: string | null
}

export interface HealthReport {
  summary: { effective: number; ineffective: number; invalid: number }
  targets: TargetHealth[]
  checkedAt: string | null
  stale: boolean
}

export async function fetchHealth(): Promise<HealthReport> {
  const { data } = await api.get<HealthReport>('/scrape/health')
  return data
}

export async function refreshHealth(): Promise<HealthReport> {
  const { data } = await api.post('/scrape/health/refresh')
  return data
}
