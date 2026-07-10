import { Table, Tag } from 'antd'
import { useState } from 'react'
import type { PrometheusAlert } from '../lib/prometheus'

interface Props {
  alerts: PrometheusAlert[]
}

export default function PromAlerts({ alerts }: Props) {
  const [pageSize, setPageSize] = useState(50)

  const columns = [
    {
      title: '级别', dataIndex: ['labels', 'severity'], width: 80,
      render: (s: string) => {
        const color = s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'
        return <Tag color={color}>{s || '-'}</Tag>
      },
    },
    { title: '名称', dataIndex: ['labels', 'alertname'], width: 200 },
    { title: '实例', dataIndex: ['labels', 'instance'], width: 180 },
    { title: 'Job', dataIndex: ['labels', 'job'], width: 140 },
    {
      title: '状态', dataIndex: 'state', width: 80,
      render: (s: string) => <Tag color={s === 'firing' ? 'red' : 'green'}>{s}</Tag>,
    },
    {
      title: '触发时间', dataIndex: 'activeAt', width: 170,
      render: (t: string) => t ? new Date(t).toLocaleString() : '-',
    },
  ]

  return (
    <Table<PrometheusAlert>
      rowKey={(r, i) => `${r.labels.alertname}-${r.labels.instance}-${i}`}
      dataSource={alerts}
      columns={columns}
      size="middle"
      pagination={{ pageSize, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'], onChange: (_, s) => setPageSize(s) }}
    />
  )
}
