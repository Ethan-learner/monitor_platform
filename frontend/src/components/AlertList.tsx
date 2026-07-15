import { Table, Tag, Typography, Empty, Alert, Button, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
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

const labelCol = (key: string, title: string, width?: number) => ({
  title,
  dataIndex: ['labels', key],
  width,
  ellipsis: true,
  render: (v: string) => v || <Text type="secondary">—</Text>,
})

export default function AlertList({ alerts, error }: AlertListProps) {
  const navigate = useNavigate()

  if (error) {
    return (
      <Alert type="error" showIcon message="告警服务暂不可用" description={error} style={{ margin: 24 }} />
    )
  }

  if (!alerts.length) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty description="当前无活跃告警" />
      </div>
    )
  }

  const columns: ColumnsType<AlertItem> = [
    {
      title: '告警级别',
      dataIndex: ['labels', 'severity'],
      width: 90,
      render: (sev: string) => <Tag color={severityColor[sev] || 'default'}>{sev || '—'}</Tag>,
    },
    { title: '告警名称', dataIndex: ['labels', 'alertname'], width: 180 },
    labelCol('instance', '实例', 180),
    labelCol('service', '服务', 100),
    labelCol('region', '地区'),
    labelCol('department', '部门'),
    labelCol('project', '项目'),
    labelCol('env', '环境'),
    {
      title: '状态',
      dataIndex: ['status', 'state'],
      width: 70,
      render: (st: string) => <Tag color={st === 'firing' ? 'red' : 'green'}>{st || '—'}</Tag>,
    },
    {
      title: '描述',
      dataIndex: ['annotations', 'summary'],
      ellipsis: true,
      render: (s: string) => <Text type="secondary">{s || '—'}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_: any, record: AlertItem) => (
        <Tooltip title="创建静默规则">
          <Button size="small" onClick={() =>
            navigate('/dashboard/silence-new', { state: { alertName: record.labels.alertname, alertLabels: record.labels } })
          }>静默</Button>
        </Tooltip>
      ),
    },
  ]

  return (
    <Table
      rowKey={(r, i) => `${r.labels.alertname}-${r.labels.instance}-${i}`}
      dataSource={alerts}
      columns={columns}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      size="middle"
      scroll={{ x: 1200 }}
    />
  )
}
