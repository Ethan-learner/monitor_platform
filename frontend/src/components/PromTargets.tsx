import { useMemo } from 'react'
import { Collapse, Table, Tag, Typography } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, CheckOutlined, CloseOutlined, LinkOutlined } from '@ant-design/icons'
import type { PrometheusTarget } from '../lib/prometheus'

const { Text } = Typography

interface Props {
  targets: PrometheusTarget[]
}

const columns = [
  {
    title: '状态', dataIndex: 'health', width: 70,
    render: (h: string) => h === 'up'
      ? <Tag icon={<CheckCircleOutlined />} color="green">UP</Tag>
      : <Tag icon={<CloseCircleOutlined />} color="red">DOWN</Tag>,
  },
  { title: '实例', dataIndex: ['labels', 'instance'], width: 200 },
  { title: '地址', dataIndex: 'scrapeUrl', width: 260, ellipsis: true,
    render: (url: string) => (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        <LinkOutlined /> {url}
      </a>
    ),
  },
  {
    title: '耗时', dataIndex: 'lastScrapeDuration', width: 80,
    render: (d: number) => `${(d * 1000).toFixed(0)}ms`,
  },
  {
    title: '最后采集', dataIndex: 'lastScrape', width: 160,
    render: (s: string) => s ? new Date(s).toLocaleString() : '-',
  },
  {
    title: '错误', dataIndex: 'lastError', width: 200, ellipsis: true,
    render: (e: string) => e ? <Text type="danger" style={{ fontSize: 12 }}>{e}</Text> : '-',
  },
]

function StatRing({ up, down }: { up: number; down: number }) {
  const total = up + down || 1
  const r = 28
  const circ = 2 * Math.PI * r
  const upPct = Math.round((up / total) * 100)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center', padding: '4px 0', marginBottom: 12 }}>
      <svg width={80} height={80}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="#ff4d4f" strokeWidth={7} />
        <circle cx={40} cy={40} r={r} fill="none" stroke="#52c41a" strokeWidth={7}
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - up / total)}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x={40} y={38} textAnchor="middle" fontSize={15} fontWeight={700} fill="#333">{upPct}%</text>
        <text x={40} y={55} textAnchor="middle" fontSize={9} fill="#999">健康度</text>
      </svg>
      <div style={{ lineHeight: 1.8 }}>
        <div style={{ fontSize: 13, color: '#52c41a' }}><CheckOutlined /> {up} 正常</div>
        <div style={{ fontSize: 13, color: '#ff4d4f' }}><CloseOutlined /> {down} 异常</div>
      </div>
    </div>
  )
}

export default function PromTargets({ targets }: Props) {
  const up = targets.filter((t) => t.health === 'up').length
  const down = targets.length - up

  const groups = useMemo(() => {
    const map = new Map<string, PrometheusTarget[]>()
    targets.forEach((t) => {
      const job = t.labels.job || 'unknown'
      if (!map.has(job)) map.set(job, [])
      map.get(job)!.push(t)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [targets])

  return (
    <div>
      <StatRing up={up} down={down} />
      <Collapse
        defaultActiveKey={groups.map((_, i) => String(i))}
        items={groups.map(([job, list], i) => ({
          key: String(i),
          label: (
            <span>
              <strong>{job}</strong>
              <Tag color="green" style={{ marginLeft: 8 }}>UP {list.filter((t) => t.health === 'up').length}</Tag>
              {list.filter((t) => t.health !== 'up').length > 0 && (
                <Tag color="red">DOWN {list.filter((t) => t.health !== 'up').length}</Tag>
              )}
            </span>
          ),
          children: (
            <Table<PrometheusTarget>
              rowKey={(r) => r.labels.instance}
              dataSource={list}
              size="small"
              pagination={list.length > 20 ? { pageSize: 20, size: 'small' } : false}
              columns={columns}
            />
          ),
        }))}
      />
    </div>
  )
}
 
