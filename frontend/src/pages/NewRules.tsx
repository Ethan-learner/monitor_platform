import { useEffect, useState, useMemo } from 'react'
import { Button, Table, Tag, Space, Typography, Badge } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { fetchParsedRules, type ParsedRule } from '../lib/rules'

const { Title } = Typography

const CATEGORY_COLORS: Record<string, string> = {
  '应用告警': '#1677ff',
  '数据库告警': '#722ed1',
  '服务器告警': '#52c41a',
  '平台组件告警': '#fa8c16',
  '性能告警': '#eb2f96',
}

export default function NewRules() {
  const [rules, setRules] = useState<ParsedRule[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setRules(await fetchParsedRules()) }
    catch { /* alerts dir not configured */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const map: Record<string, ParsedRule[]> = {}
    rules.forEach((r) => { (map[r.category] = map[r.category] || []).push(r) })
    return map
  }, [rules])

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>告警规则 ({rules.length})</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <Space style={{ marginBottom: 8 }}>
            <Badge color={CATEGORY_COLORS[cat] || '#d9d9d9'} />
            <strong>{cat}</strong>
            <Tag>{items.length}</Tag>
          </Space>
          <Table<ParsedRule>
            rowKey={(r, i) => r.name + i}
            dataSource={items}
            size="small"
            pagination={false}
            columns={[
              { title: '告警名称', dataIndex: 'name', width: 200 },
              { title: '表达式', dataIndex: 'expr', ellipsis: true, render: (e: string) => <code style={{ fontSize: 11 }}>{e}</code> },
              { title: '持续', dataIndex: 'for', width: 80 },
              { title: '级别', dataIndex: 'severity', width: 70, render: (s: string) => (
                <Tag color={s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'}>{s || '-'}</Tag>
              )},
              { title: '文件', dataIndex: 'file', width: 200 },
              { title: '描述', dataIndex: 'summary', ellipsis: true },
            ]}
          />
        </div>
      ))}
      {!loading && rules.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          告警规则目录不可达。部署后配置 alerts_dir 或 SSH 即可使用。
        </div>
      )}
    </div>
  )
}
