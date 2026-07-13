import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface NodeInfo { url: string; up: boolean; latency_ms: number | null }
interface HealthData { status: string; nodes?: NodeInfo[]; redis_ok?: boolean; timestamp?: string }

function FlowTopo({ health }: { health: HealthData | null }) {
  const ok = (v?: boolean) => v === true; const dot = (v?: boolean) => ok(v) ? '#52c41a' : v === false ? '#ff4d4f' : '#bbb'; const lbl = (v?: boolean) => ok(v) ? '正常' : v === false ? '异常' : '未知'
  const W = 1200; const H = 380
  const amCx = 100; const whCx = 320; const midCx = 580; const dstCx = 880
  const y1 = 80; const y2 = 220; const y3 = 360
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`
  const paths: Array<{y:number;label:string;fill:string}> = [{ y: y1, label: '邮件 / 飞书', fill: '#f6ffed' }, { y: y2, label: 'VM 落盘', fill: '#fff7e6' }, { y: y3, label: 'Kafka', fill: '#f9f0ff' }]

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        <defs><marker id="ar" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,1 L8,4 L0,7" fill="#1677ff" /></marker></defs>
        <rect x={amCx - 65} y={165} width={130} height={50} rx={10} fill="#f0f5ff" stroke="#2f54eb" strokeWidth={1.5} />
        <text x={amCx} y={188} textAnchor="middle" fontSize={14} fill="#2f54eb" fontWeight={600}>Alertmanager</text>
        <text x={amCx} y={204} textAnchor="middle" fontSize={10} fill="#999">告警源</text>
        <path d={curve(amCx + 65, 190, whCx - 60, 190)} fill="none" stroke="#1677ff" strokeWidth={2} markerEnd="url(#ar)" />
        <text x={200} y={178} textAnchor="middle" fontSize={10} fill="#bbb">POST /alerts</text>
        <rect x={whCx - 60} y={155} width={120} height={70} rx={10} fill="#e6f7ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={whCx} y={185} textAnchor="middle" fontSize={14} fill="#1677ff" fontWeight={600}>Webhook</text>
        <text x={whCx} y={205} textAnchor="middle" fontSize={12} fill={health?.status === 'up' ? '#52c41a' : '#ff4d4f'}>{health?.status === 'up' ? '正常' : '异常'}</text>
        <circle cx={whCx - 46} cy={172} r={5} fill={health?.status === 'up' ? '#52c41a' : '#bbb'} />
        {paths.map((p, i) => (
          <path key={`w2c-${i}`} d={curve(whCx + 60, 190 + (i - 1) * 16, midCx - 60, p.y)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        ))}
        {paths.map((p, i) => (
          <g key={`ch-${i}`}>
            <rect x={midCx - 70} y={p.y - 28} width={140} height={56} rx={10} fill={p.fill} stroke="#ccc" strokeWidth={1} />
            <text x={midCx} y={p.y - 2} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>{p.label}</text>
          </g>
        ))}
        {paths.map((p, i) => (
          <path key={`c2d-${i}`} d={curve(midCx + 70, p.y, dstCx - 80, p.y)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        ))}
        {[{ y: y1, t: 'Exchange / 飞书 API' }, { y: y2, t: 'VictoriaMetrics' }, { y: y3, t: 'Kafka → Flink → Doris' }].map((d, i) => (
          <g key={`dst-${i}`}><rect x={dstCx - 80} y={d.y - 18} width={160} height={36} rx={8} fill="#fafafa" stroke="#eee" /><text x={dstCx} y={d.y + 4} textAnchor="middle" fontSize={11} fill="#999">{d.t}</text></g>
        ))}
        {paths.map((p, i) => (
          <circle key={`pt-${i}`} r={4} fill="#1677ff" opacity={0.7}>
            <animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={`${curve(whCx + 60, 190 + (i - 1) * 16, midCx - 60, p.y)} ${curve(midCx + 70, p.y, dstCx - 80, p.y)}`} />
          </circle>
        ))}
      </svg>
    </div>
  )
}

export default function WebhookEvents() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const load = async () => { setLoading(true); try { const { data } = await api.get('/webhook/health'); setHealth(data) } catch { setHealth(null) }; setLoading(false) }
  useEffect(() => { load() }, [])

  const nodes = health?.nodes || []
  const nodeNames = (i: number) => `monitor0${i + 1}`

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 8, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>Webhook 告警分发</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>

      <Card size="small" style={{ marginBottom: 16, background: '#fafbfc' }}>
        <FlowTopo health={health} />
      </Card>

      <Card title="分发通道" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          {[{ k:'notify', n:'邮件 / 飞书' }, { k:'vm', n:'VM 落盘' }, { k:'kafka', n:'Kafka 推送' }].map((ch) => (
            <Col span={8} key={ch.k}>
              <Card size="small">
                <Row justify="space-between" align="middle">
                  <Col><strong>{ch.n}</strong></Col>
                  <Col><Tag color="green">正常</Tag></Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="集群节点" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          {nodes.map((n, i) => (
            <Col span={8} key={n.url}>
              <Card size="small">
                <Row justify="space-between" align="middle">
                  <Col><strong>{nodeNames(i)}</strong></Col>
                  <Col>
                    {n.up ? <Tag color="green">存活</Tag> : <Tag color="red">宕机</Tag>}
                    <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{n.latency_ms != null ? `${n.latency_ms}ms` : '超时'}</span>
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="运行信息" size="small">
        <Row gutter={24}>
          <Col span={6}><Statistic title="Redis 防抖" value={health?.redis_ok ? '正常' : health ? '异常' : '-'} valueStyle={{ color: health?.redis_ok ? '#52c41a' : '#ff4d4f' }} /></Col>
          <Col span={6}><Statistic title="总节点" value={nodes.length} suffix="个" /></Col>
          <Col span={6}><Statistic title="存活" value={nodes.filter(n => n.up).length} suffix="个" valueStyle={{ color: '#52c41a' }} /></Col>
          <Col span={6}><Statistic title="最后活跃" value={health?.timestamp ? health.timestamp.substring(11, 19) : '-'} /></Col>
        </Row>
      </Card>
    </div>
  )
}
