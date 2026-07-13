import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface HealthData {
  status: string; kafka_ok: boolean; redis_ok: boolean; timestamp: string
  mail_ok?: boolean; lark_ok?: boolean; vm_ok?: boolean
  stats?: { email_sent: number; email_failed: number; lark_sent: number; lark_failed: number; vm_writes: number; vm_failed: number; kafka_sent: number; kafka_failed: number }
}

function FlowTopo({ health }: { health: HealthData | null }) {
  const ok = (v?: boolean) => v === true
  const dot = (v?: boolean) => ok(v) ? '#52c41a' : v === false ? '#ff4d4f' : '#bbb'
  const lbl = (v?: boolean) => ok(v) ? '正常' : v === false ? '异常' : '未知'

  const W = 1200; const H = 460
  // centers
  const amCx = 100; const whCx = 320; const midCx = 580
  const dstCx = 880; const endCx = 1080
  const y1 = 90; const y2 = 230; const y3 = 370 // 3 lane Ys

  // curve helper
  const curve = (x1: number, y1: number, x2: number, y2: number) =>
    `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`

  const paths = [
    { y: y1, label: '邮件 / 飞书', ok: health?.mail_ok, fill: '#f6ffed' },
    { y: y2, label: 'VM 落盘', ok: health?.vm_ok, fill: '#fff7e6' },
    { y: y3, label: 'Kafka', ok: health?.kafka_ok, fill: '#f9f0ff' },
  ]

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <marker id="ar" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,1 L8,4 L0,7" fill="#1677ff" />
          </marker>
        </defs>

        {/* === Alertmanager === */}
        <rect x={amCx - 65} y={200} width={130} height={60} rx={12} fill="#f0f5ff" stroke="#2f54eb" strokeWidth={1.5} />
        <text x={amCx} y={226} textAnchor="middle" fontSize={14} fill="#2f54eb" fontWeight={600}>Alertmanager</text>
        <text x={amCx} y={246} textAnchor="middle" fontSize={11} fill="#999">告警源</text>

        {/* AM → Webhook curve */}
        <path d={curve(amCx + 65, 230, whCx - 60, 230)} fill="none" stroke="#1677ff" strokeWidth={2} markerEnd="url(#ar)" />
        <text x={200} y={218} textAnchor="middle" fontSize={10} fill="#bbb">POST /alerts</text>

        {/* === Webhook === */}
        <rect x={whCx - 60} y={194} width={120} height={72} rx={12} fill="#e6f7ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={whCx} y={222} textAnchor="middle" fontSize={14} fill="#1677ff" fontWeight={600}>Webhook</text>
        <text x={whCx} y={242} textAnchor="middle" fontSize={11} fill={dot(health?.status === 'healthy')}>{health ? lbl(health?.status === 'healthy') : '未知'}</text>
        <circle cx={whCx - 46} cy={210} r={5} fill={health?.status === 'healthy' ? '#52c41a' : '#bbb'} />

        {/* Webhook → 3 channels (curves) */}
        {paths.map((p, i) => (
          <path key={`w2c-${i}`} d={curve(whCx + 60, 230 + (i - 1) * 16, midCx - 60, p.y)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        ))}

        {/* === 3 Channel nodes === */}
        {paths.map((p, i) => (
          <g key={`ch-${i}`}>
            <rect x={midCx - 70} y={p.y - 30} width={140} height={60} rx={10} fill={p.fill} stroke={dot(p.ok)} strokeWidth={1.5} />
            <text x={midCx} y={p.y - 6} textAnchor="middle" fontSize={13} fill="#333" fontWeight={600}>{p.label}</text>
            <text x={midCx} y={p.y + 14} textAnchor="middle" fontSize={10} fill={dot(p.ok)}>{lbl(p.ok)}</text>
            <circle cx={midCx - 56} cy={p.y - 18} r={4} fill={dot(p.ok)} />
          </g>
        ))}

        {/* Channels → Destinations (curves) */}
        {paths.map((p, i) => (
          <path key={`c2d-${i}`} d={curve(midCx + 70, p.y, dstCx - 80, p.y)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        ))}

        {/* === Destination labels === */}
        {[
          { y: y1, t: 'Exchange / 飞书 API' },
          { y: y2, t: 'VictoriaMetrics' },
          { y: y3, t: 'Kafka → Flink → Doris' },
        ].map((d, i) => (
          <g key={`dst-${i}`}>
            <rect x={dstCx - 80} y={d.y - 20} width={160} height={40} rx={8} fill="#fafafa" stroke="#eee" />
            <text x={dstCx} y={d.y + 5} textAnchor="middle" fontSize={11} fill="#999">{d.t}</text>
          </g>
        ))}

        {/* === Particles: 3 dots, synchronized === */}
        {paths.map((p, i) => (
          <circle key={`pt-${i}`} r={4} fill="#1677ff" opacity={0.7}>
            <animateMotion dur="3s" repeatCount="indefinite" begin="0s"
              path={`${curve(whCx + 60, 230 + (i - 1) * 16, midCx - 60, p.y)} ${curve(midCx + 70, p.y, dstCx - 80, p.y)}`} />
          </circle>
        ))}

        {/* === Redis label === */}
        <text x={whCx} y={320} textAnchor="middle" fontSize={10} fill="#ccc">Redis Sentinel · 告警防抖 / 状态管理</text>
      </svg>
    </div>
  )
}

export default function WebhookEvents() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get('/webhook/status'); setHealth(data) } catch { setHealth(null) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const channels = [
    { name: '邮件 / 飞书', key: 'notify', ok: (health?.mail_ok && health?.lark_ok) || health?.mail_ok || health?.lark_ok, sent: (health?.stats?.email_sent || 0) + (health?.stats?.lark_sent || 0), failed: (health?.stats?.email_failed || 0) + (health?.stats?.lark_failed || 0) },
    { name: 'VM 落盘', key: 'vm', ok: health?.vm_ok, sent: health?.stats?.vm_writes, failed: health?.stats?.vm_failed },
    { name: 'Kafka 推送', key: 'kafka', ok: health?.kafka_ok, sent: health?.stats?.kafka_sent, failed: health?.stats?.kafka_failed },
  ]

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
          {channels.map((ch) => (
            <Col span={8} key={ch.key}>
              <Card size="small">
                <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                  <Col><strong>{ch.name}</strong></Col>
                  <Col>
                    {ch.ok === true && <Tag color="green">正常</Tag>}
                    {ch.ok === false && <Tag color="red">异常</Tag>}
                    {ch.ok === undefined && <Tag>待接入</Tag>}
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}><Statistic title="成功" value={ch.sent ?? '-'} valueStyle={{ color: '#52c41a', fontSize: 18 }} /></Col>
                  <Col span={12}><Statistic title="失败" value={ch.failed ?? '-'} valueStyle={{ color: '#ff4d4f', fontSize: 18 }} /></Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="运行信息" size="small">
        <Row gutter={24}>
          <Col span={6}><Statistic title="Redis 防抖" value={health?.redis_ok ? '正常' : health ? '异常' : '-'} valueStyle={{ color: health?.redis_ok ? '#52c41a' : '#ff4d4f' }} /></Col>
          <Col span={6}><Statistic title="发送成功" value={(health?.stats?.email_sent||0)+(health?.stats?.lark_sent||0)+(health?.stats?.vm_writes||0)} suffix="次" /></Col>
          <Col span={6}><Statistic title="发送失败" value={(health?.stats?.email_failed||0)+(health?.stats?.lark_failed||0)+(health?.stats?.vm_failed||0)} suffix="次" /></Col>
          <Col span={6}><Statistic title="最后活跃" value={health?.timestamp ? health.timestamp.substring(11, 19) : '-'} /></Col>
        </Row>
      </Card>
    </div>
  )
}
