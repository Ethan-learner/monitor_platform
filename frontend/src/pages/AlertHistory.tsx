import { useEffect, useState } from 'react'
import { Table, Tag, Typography, Button, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface HistoryAlert {
  alertName: string
  alertTime: string
  instance: string
  severity: string
  department: string
  project: string
  env: string
  service: string
  status: string
  summary: string
}

export default function AlertHistory() {
  const [data, setData] = useState<HistoryAlert[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data: d } = await api.get('/alerts/history', { params: { limit: 100, offset: 0 } })
      setData(d.data)
      setTotal(d.total)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const sevColor: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>历史告警 ({total})</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>
      <Table<HistoryAlert>
        rowKey={(r, i) => r.alertName + r.alertTime + i}
        dataSource={data} size="middle"
        pagination={{ total, pageSize: 100, showSizeChanger: false }}
        columns={[
          { title: '告警名称', dataIndex: 'alertName', width: 180 },
          { title: '级别', dataIndex: 'severity', width: 80, render: (s: string) => <Tag color={sevColor[s] || 'default'}>{s}</Tag> },
          { title: '实例', dataIndex: 'instance', width: 160 },
          { title: '时间', dataIndex: 'alertTime', width: 160, render: (s: string) => s ? new Date(s).toLocaleString() : '-' },
          { title: '状态', dataIndex: 'status', width: 70, render: (s: string) => <Tag color={s === 'firing' ? 'red' : 'green'}>{s}</Tag> },
          { title: '部门', dataIndex: 'department', width: 100 },
          { title: '项目', dataIndex: 'project', width: 80 },
          { title: '环境', dataIndex: 'env', width: 70 },
          { title: '服务', dataIndex: 'service', width: 100 },
          { title: '描述', dataIndex: 'summary', ellipsis: true },
        ]}
      />
    </div>
  )
}
