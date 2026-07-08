import { useEffect, useState, useMemo } from 'react'
import { Button, Tabs, Badge } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { fetchTargets, fetchPromAlerts } from '../lib/prometheus'
import type { PrometheusTarget, PrometheusAlert } from '../lib/prometheus'
import PromTargets from '../components/PromTargets'
import PromAlerts from '../components/PromAlerts'

export default function PrometheusPage() {
  const [targets, setTargets] = useState<PrometheusTarget[]>([])
  const [alerts, setAlerts] = useState<PrometheusAlert[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [t, a] = await Promise.all([fetchTargets(), fetchPromAlerts()])
      setTargets(t.data?.activeTargets || [])
      setAlerts(a.data?.alerts || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const downCount = useMemo(() => targets.filter((t) => t.health !== 'up').length, [targets])

  return (
    <Tabs
      style={{ padding: '0 16px' }}
      tabBarExtraContent={<Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading}>刷新</Button>}
        items={[
          {
            key: 'targets',
            label: (
              <span>
                Targets ({targets.length})
                {downCount > 0 && (
                  <Badge count={downCount} size="small" offset={[6, -2]} color="#ff4d4f" style={{ fontSize: 10 }} />
                )}
              </span>
            ),
            children: <PromTargets targets={targets} />,
          },
          {
            key: 'alerts', label: `Alerts (${alerts.length})`,
            children: <PromAlerts alerts={alerts} />,
          },
        ]}
      />
  )
}
