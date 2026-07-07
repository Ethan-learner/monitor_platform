import { Table, Tag, Typography, Empty, Alert } from 'antd'
import type { AlertItem } from '../lib/alerts'

const { Text } = Typography

const severityColor: Record<string, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'blue',
}

interface AlertListProps {
  alerts: AlertItem[]
  error?: string | null
}

export default function AlertList({ alerts, error }: AlertListProps) {
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="告警服务暂不可用"
        description={error}
        style={{ margin: 24 }}
      />
    )
  }

  if (!alerts.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty description="当前无活跃告警" />
      </div>
    )
  }

  const columns = [
    {
      title: '严重度',
      dataIndex: ['labels', 'severity'],
      width: 100,
      render: (sev: string) => <Tag color={severityColor[sev] || 'default'}>{sev || 'unknown'}</Tag>,
    },
    { title: '告警名', dataIndex: ['labels', 'alertname'], width: 200 },
    { title: '实例', dataIndex: ['labels', 'instance'], width: 180 },
    {
      title: '摘要',
      dataIndex: ['annotations', 'summary'],
      render: (s: string) => <Text type="secondary">{s}</Text>,
    },
    {
      title: '状态',
      dataIndex: ['status', 'state'],
      width: 90,
      render: (st: string) => <Tag color={st === 'firing' ? 'red' : 'green'}>{st || 'firing'}</Tag>,
    },
  ]

  return (
    <Table
      rowKey={(r, i) => `${r.labels.alertname}-${r.labels.instance}-${i}`}
      dataSource={alerts}
      columns={columns}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      size="middle"
    />
  )
}
