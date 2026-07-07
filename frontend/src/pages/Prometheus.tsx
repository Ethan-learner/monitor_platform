import { useEffect, useState, useMemo } from 'react'
import { Button, Tabs, Badge } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { fetchTargets, fetchPromAlerts, fetchRules } from '../lib/prometheus'
import type { PrometheusTarget, PrometheusAlert, RuleGroup } from '../lib/prometheus'
import PromTargets from '../components/PromTargets'
import PromAlerts from '../components/PromAlerts'
import PromRules from '../components/PromRules'

export default function PrometheusPage() {
  const [targets, setTargets] = useState<PrometheusTarget[]>([])
  const [alerts, setAlerts] = useState<PrometheusAlert[]>([])
  const [rules, setRules] = useState<RuleGroup[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [t, a, r] = await Promise.all([fetchTargets(), fetchPromAlerts(), fetchRules()])
      setTargets(t.data?.activeTargets || [])
      setAlerts(a.data?.alerts || [])
      setRules(r.data?.groups || [])
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
          {
            key: 'rules', label: `Rules (${rules.reduce((s, g) => s + g.rules.length, 0)})`,
            children: <PromRules groups={rules} />,
          },
        ]}
      />
  )
}
