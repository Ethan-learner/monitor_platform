import { useEffect, useState } from 'react'
import { Typography, Card, Row, Col, Statistic, Button, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import OverviewHealth from '../components/OverviewHealth'
import { fetchHealth, fetchAlertsSummary, type ComponentHealth, type AlertsSummary } from '../lib/overview'
import { useAuthStore } from '../store/authStore'
import { roleMenus, type MenuItem } from '../config/menus'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

function findLeafUrl(items: MenuItem[]): string | undefined {
  for (const item of items) {
    if (item.url) return item.url
    if (item.children) {
      const found = findLeafUrl(item.children)
      if (found) return found
    }
  }
}

export default function Overview() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [health, setHealth] = useState<ComponentHealth[]>([])
  const [summary, setSummary] = useState<AlertsSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [h, s] = await Promise.all([fetchHealth(), fetchAlertsSummary()])
      setHealth(h)
      setSummary(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const menus = roleMenus[user?.role || 'dev']?.menus || []
  const quickBoards = menus.filter((m) => m.children).flatMap((m) => m.children!).filter((c) => c.url).slice(0, 6)

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>总览首页</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>

      <Card title="告警摘要" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}><Statistic title="Critical" value={summary?.critical ?? '-'} valueStyle={{ color: '#cf1322' }} /></Col>
          <Col span={4}><Statistic title="Warning" value={summary?.warning ?? '-'} valueStyle={{ color: '#d48806' }} /></Col>
          <Col span={4}><Statistic title="Info" value={summary?.info ?? '-'} /></Col>
          <Col span={4}><Statistic title="其他" value={summary?.other ?? '-'} /></Col>
          <Col span={4}><Statistic title="合计" value={summary?.total ?? '-'} /></Col>
        </Row>
      </Card>

      <Card title="组件健康" size="small" style={{ marginBottom: 16 }}>
        <OverviewHealth health={health} loading={loading} />
      </Card>

      <Card title="常用看板" size="small">
        <Space wrap>
          {quickBoards.map((b) => (
            <Button key={b.key} onClick={() => navigate(`/dashboard/${b.key}`)}>{b.label}</Button>
          ))}
        </Space>
      </Card>
    </div>
  )
}
