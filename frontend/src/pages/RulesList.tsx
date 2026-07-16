import { useEffect, useState, useMemo } from 'react'
import { Table, Tag, Badge, Button, Space, Typography, Tooltip } from 'antd'
import { ReloadOutlined, BellOutlined } from '@ant-design/icons'
import { fetchActiveAlerts, type ActiveAlert } from '../lib/rules'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { cacheGet, cacheSet } from '../lib/cache'

const { Title, Text } = Typography

const CATEGORY_COLORS: Record<string, string> = {
  '应用告警': '#1677ff',
  '数据库告警': '#722ed1',
  '服务器告警': '#52c41a',
  '平台组件告警': '#fa8c16',
  '性能告警': '#eb2f96',
}

const CATEGORY_ORDER = ['服务器告警', '数据库告警', '平台组件告警', '应用告警', '性能告警']

const lbl = (key: keyof ActiveAlert, title: string, w?: number) => ({
  title, dataIndex: key, width: w, ellipsis: true, align: 'center' as const,
  render: (v: string) => v || <Text type="secondary">—</Text>,
})

export default function RulesList() {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchActiveAlerts()
      setAlerts(data); cacheSet('rules:alerts', data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => {
    const cached = cacheGet('rules:alerts')
    if (cached) setAlerts(cached)
    load()
  }, [])

  const unifiedAlerts = useMemo(() => {
    const earliest: Record<string, string> = {}
    for (const a of alerts) {
      const key = `${a.name}|${a.instance}`
      if (!earliest[key] || new Date(a.activeAt) < new Date(earliest[key])) {
        earliest[key] = a.activeAt
      }
    }
    return alerts.map(a => {
      const key = `${a.name}|${a.instance}`
      return { ...a, activeAt: earliest[key] || a.activeAt }
    })
  }, [alerts])

  const grouped = useMemo(() => {
    const sorted = [...unifiedAlerts].sort((a, b) => new Date(b.activeAt).getTime() - new Date(a.activeAt).getTime())
    const map: Record<string, ActiveAlert[]> = {}
    sorted.forEach((a) => { (map[a.category] = map[a.category] || []).push(a) })
    return map
  }, [unifiedAlerts])

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

      {CATEGORY_ORDER.filter(cat => grouped[cat]).map((cat) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <Space style={{ marginBottom: 8 }}>
            <Badge color={CATEGORY_COLORS[cat] || '#d9d9d9'} />
            <strong>{cat}</strong>
            <Tag color={grouped[cat].some(a => a.severity === 'critical') ? 'red' : 'orange'}>{grouped[cat].length}</Tag>
          </Space>
          <Table<ActiveAlert>
            rowKey={(r, i) => r.name + r.instance + i}
            dataSource={grouped[cat]}
            bordered
            pagination={false}
            scroll={{ x: 1200 }}
            columns={[
              { title: '告警级别', dataIndex: 'severity', width: 100, align: 'center',
                render: (s: string) => <Tag color={severityColor[s] || 'default'}>{s || '—'}</Tag> },
              { title: '告警名称', dataIndex: 'name', width: 150, align: 'center' },
              { title: '实例', dataIndex: 'instance', width: 150, align: 'center' },
              { title: '服务', dataIndex: 'service', width: 150, align: 'center' },
              { title: '地区', dataIndex: 'region', width: 120, align: 'center' },
              { title: '部门', dataIndex: 'department', width: 150, align: 'center' },
              { title: '项目', dataIndex: 'project', width: 150, align: 'center' },
              { title: '环境', dataIndex: 'env', width: 120, align: 'center' },
              // lbl('instance', '实例', 180),
              // lbl('service', '服务'),
              // lbl('region', '地区'),
              // lbl('department', '部门'),
              // lbl('project', '项目'),
              // lbl('env', '环境'),
              { title: '触发时间', dataIndex: 'activeAt', width: 150, align: 'center',
                render: (t: string) => t ? new Date(t).toLocaleString() : '—' },
              { title: '状态', dataIndex: 'state', width: 80, align: 'center',
                render: (s: string) => <Tag color={s === 'firing' ? 'red' : 'green'}>{s}</Tag> },
              { title: '描述', dataIndex: 'summary', ellipsis: true },
              { title: '操作', key: 'action', width: 80, align: 'center',
                render: (_: any, r: ActiveAlert) => (
                  <Tooltip title="静默处理">
                    <Button size="small" type="text" icon={<BellOutlined style={{ color: '#fa8c16' }} />}
                      onClick={() => navigate('/dashboard/silence-new', { state: { alertName: r.name, alertLabels: { alertname: r.name, instance: r.instance, job: r.job, service: r.service } } })} />
                  </Tooltip>
                ) },
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
