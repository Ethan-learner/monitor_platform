import { Table, Tag, Typography, Button, Tooltip } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PrometheusAlert } from '../lib/prometheus'

const { Text } = Typography

interface Props {
  alerts: PrometheusAlert[]
}

const lbl = (key: string, title: string, w?: number) => ({
  title, dataIndex: ['labels', key], width: w, ellipsis: true,
  render: (v: string) => v || <Text type="secondary">—</Text>,
})

export default function PromAlerts({ alerts }: Props) {
  const [pageSize, setPageSize] = useState(50)
  const navigate = useNavigate()

  const columns = [
    {
      title: '告警级别', dataIndex: ['labels', 'severity'], width: 90,
      render: (s: string) => {
        const color = s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'
        return <Tag color={color}>{s || '—'}</Tag>
      },
    },
    { title: '告警名称', dataIndex: ['labels', 'alertname'], width: 180 },
    lbl('instance', '实例', 180),
    lbl('service', '服务'),
    lbl('region', '地区'),
    lbl('department', '部门'),
    lbl('project', '项目'),
    lbl('env', '环境'),
    {
      title: '状态', dataIndex: 'state', width: 70,
      render: (s: string) => <Tag color={s === 'firing' ? 'red' : 'green'}>{s}</Tag>,
    },
    {
      title: '描述', dataIndex: ['annotations', 'summary'], ellipsis: true,
      render: (s: string) => <Text type="secondary">{s || '—'}</Text>,
    },
    {
      title: '操作', key: 'action', width: 80, align: 'center',
      render: (_: any, record: PrometheusAlert) => (
        <Tooltip title="创建静默规则">
          <Button size="small" onClick={() =>
            navigate('/dashboard/silence-new', { state: { alertName: record.labels.alertname, alertLabels: record.labels } })
          }>静默</Button>
        </Tooltip>
      ),
    },
  ]

  return (
    <Table<PrometheusAlert>
      rowKey={(r, i) => `${r.labels.alertname}-${r.labels.instance}-${i}`}
      dataSource={alerts}
      columns={columns}
      size="middle"
      scroll={{ x: 1200 }}
      pagination={{ pageSize, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'], onChange: (_, s) => setPageSize(s) }}
    />
  )
}
