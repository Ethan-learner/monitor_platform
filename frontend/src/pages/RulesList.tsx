import { useEffect, useState, useMemo } from 'react'
import { Table, Tag, Badge, Button, Space, Typography, Tooltip } from 'antd'
import { ReloadOutlined, BellOutlined } from '@ant-design/icons'
import { fetchActiveAlerts, type ActiveAlert } from '../lib/rules'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const { Title } = Typography

const CATEGORY_COLORS: Record<string, string> = {
  '应用告警': '#1677ff',
  '数据库告警': '#722ed1',
  '服务器告警': '#52c41a',
  '平台组件告警': '#fa8c16',
  '性能告警': '#eb2f96',
}

export default function RulesList() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchActiveAlerts()
      setAlerts(data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const map: Record<string, ActiveAlert[]> = {}
    alerts.forEach((a) => {
      (map[a.category] = map[a.category] || []).push(a)
    })
    return map
  }, [alerts])

  const severityColor: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>
          当前告警
          {alerts.length > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{alerts.length} 条</Tag>}
        </Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <Space style={{ marginBottom: 8 }}>
            <Badge color={CATEGORY_COLORS[cat] || '#d9d9d9'} />
            <strong>{cat}</strong>
            <Tag color={items.some(a => a.severity === 'critical') ? 'red' : items.length > 0 ? 'orange' : 'default'}>{items.length}</Tag>
          </Space>
          <Table<ActiveAlert>
            rowKey={(r, i) => r.name + r.instance + i}
            dataSource={items}
            size="middle" bordered
            pagination={false}
            columns={[
              {
                title: '级别', dataIndex: 'severity', width: 70,
                render: (s: string) => <Tag color={severityColor[s] || 'default'}>{s || '-'}</Tag>,
              },
              { title: '告警名称', dataIndex: 'name', width: 200 },
              { title: '实例', dataIndex: 'instance', width: 180 },
              { title: 'Job', dataIndex: 'job', width: 140 },
              {
                title: '状态', dataIndex: 'state', width: 70,
                render: (s: string) => <Tag color={s === 'firing' ? 'red' : 'green'}>{s}</Tag>,
              },
              { title: '描述', dataIndex: 'summary', ellipsis: true },
              {
                title: '', width: 40,
                render: (_: any, r: ActiveAlert) => (
                  <Tooltip title="静默处理">
                    <Button size="small" type="text" icon={<BellOutlined style={{ color: '#fa8c16' }} />}
                      onClick={() => navigate('/dashboard/silence-new', { state: { alertName: r.name, alertLabels: { alertname: r.name, instance: r.instance, job: r.job }, createdBy: user?.displayName || user?.username || '' } })} />
                  </Tooltip>
                ),
              },
            ]}
          />
        </div>
      ))}

      {!loading && alerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>当前无活跃告警</div>
      )}
    </div>
  )
}
