import { api } from './api'

export interface ScrapeTarget {
  id: number
  department: string
  category: string
  targets: string[]
  labels: Record<string, string>
  status: 1 | 0 | -1
  description: string
  operator: string
  createdAt: string
}

export async function fetchTargets(): Promise<ScrapeTarget[]> {
  const { data } = await api.get<ScrapeTarget[]>('/scrape/targets')
  return data || []
}

export async function fetchDepartments(): Promise<string[]> {
  const { data } = await api.get<string[]>('/scrape/departments')
  return data || []
}

export async function createTarget(data: {
  department: string
  category: string
  targets: string[]
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
    targets: data.targets.filter(Boolean),
    labels: labelsObj,
    description: data.description,
  })
  return res
}

export async function updateTarget(id: number, data: {
  targets: string[]
  labels: string
  description: string
}): Promise<void> {
  const labelsObj: Record<string, string> = {}
  if (data.labels) {
    data.labels.split('\n').forEach((line) => {
      const [k, ...v] = line.split('=')
      if (k && v.length) labelsObj[k.trim()] = v.join('=').trim()
    })
  }
  await api.put(`/scrape/targets/${id}`, {
    targets: data.targets.filter(Boolean),
    labels: labelsObj,
    description: data.description,
  })
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
