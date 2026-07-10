import { Table, Tag, Collapse } from 'antd'
import type { RuleGroup, PromRule } from '../lib/prometheus'

interface Props {
  groups: RuleGroup[]
}

const columns = [
  {
    title: '健康', dataIndex: 'health', width: 70,
    render: (h: string) => <Tag color={h === 'ok' ? 'green' : 'red'}>{h}</Tag>,
  },
  { title: '名称', dataIndex: 'name', width: 240 },
  {
    title: '类型', dataIndex: 'type', width: 100,
    render: (t: string) => <Tag>{t}</Tag>,
  },
  {
    title: '表达式', dataIndex: 'query', ellipsis: true,
    render: (q: string) => <code style={{ fontSize: 12 }}>{q}</code>,
  },
  {
    title: '持续时间', dataIndex: 'duration', width: 80,
    render: (d: number) => d ? `${d}s` : '-',
  },
  {
    title: '告警数', dataIndex: 'alerts', width: 70,
    render: (a: PromRule['alerts']) => a?.length || 0,
  },
]

export default function PromRules({ groups }: Props) {
  return (
    <Collapse
      defaultActiveKey={groups.map((_, i) => String(i))}
      items={groups.map((g, i) => ({
        key: String(i),
        label: (
          <span>
            <strong>{g.name}</strong>
            <Tag style={{ marginLeft: 8 }}>{g.rules.length} rules</Tag>
            {g.interval && <Tag color="blue">{g.interval}s</Tag>}
          </span>
        ),
        children: (
          <Table<PromRule>
            rowKey={(r, j) => `${r.name}-${j}`}
            dataSource={g.rules}
            size="middle"
            pagination={g.rules.length > 20 ? { pageSize: 20, size: 'small' } : false}
            columns={columns}
          />
        ),
      }))}
    />
  )
}
