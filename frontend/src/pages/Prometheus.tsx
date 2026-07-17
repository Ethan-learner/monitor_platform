import { useEffect, useState, useMemo } from 'react'
import { Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { fetchTargets } from '../lib/prometheus'
import type { PrometheusTarget } from '../lib/prometheus'
import PromTargets from '../components/PromTargets'

export default function PrometheusPage() {
  const [targets, setTargets] = useState<PrometheusTarget[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const t = await fetchTargets()
      setTargets(t.data?.activeTargets || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const downCount = useMemo(() => targets.filter((t) => t.health !== 'up').length, [targets])

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Prometheus Targets</span>
        <span style={{ fontSize: 13, color: '#666' }}>共 {targets.length}</span>
        {downCount > 0 && <span style={{ fontSize: 13, color: '#ff4d4f' }}>{downCount} down</span>}
        <Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading}>刷新</Button>
      </div>
      <PromTargets targets={targets} />
    </div>
  )
}
