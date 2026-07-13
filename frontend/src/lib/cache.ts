const cache = new Map<string, { data: any; ts: number }>()
const TTL = 30000 // 30s

export function cacheGet(key: string) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < TTL) return entry.data
  cache.delete(key)
  return null
}

export function cacheSet(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() })
}
