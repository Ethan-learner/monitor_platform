import { useEffect, useState } from 'react'
import { Typography, Button, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import AlertList from '../components/AlertList'
import { fetchAlerts, type AlertItem } from '../lib/alerts'

const { Title } = Typography

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAlerts(true)
      setAlerts(data)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'fetch_failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>告警中心</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>
      <AlertList alerts={alerts} error={error} />
    </div>
  )
}
