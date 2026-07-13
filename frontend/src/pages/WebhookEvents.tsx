import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button, Table } from 'antd'
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

  const W = 1100; const H = 200
  const cy = 100 // vertical center

  // Node positions (horizontally spread)
  const am = { x: 30, w: 130 }       // Alertmanager
  const wh = { x: 260, w: 120 }       // Webhook
  const n1 = { x: 530, w: 140 }       // 邮件/飞书
  const n2 = { x: 530, w: 140, y: cy }       // VM (center)
  const n3 = { x: 530, w: 140 }       // Kafka
  const dst = { x: 830, w: 160 }      // Destinations

  const amCx = am.x + am.w / 2; const amCy = cy
  const whCx = wh.x + wh.w / 2; const whCy = cy
  const n1Cy = 40; const n2Cy = cy; const n3Cy = 160

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <marker id="ar" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto"><path d="M0,3 L10,5 L0,7" fill="#bbb" /></marker>
        </defs>

        {/* === Alertmanager === */}
        <rect x={am.x} y={cy - 30} width={am.w} height={60} rx={10} fill="#f0f5ff" stroke="#2f54eb" strokeWidth={1.5} />
        <text x={amCx} y={cy - 6} textAnchor="middle" fontSize={13} fill="#2f54eb" fontWeight={600}>Alertmanager</text>
        <text x={amCx} y={cy + 14} textAnchor="middle" fontSize={11} fill="#999">告警源</text>

        {/* AM → Webhook line */}
        <line x1={am.x + am.w} y1={cy} x2={wh.x} y2={cy} stroke="#2f54eb" strokeWidth={2} markerEnd="url(#ar)" />
        <text x={(am.x + am.w + wh.x) / 2} y={cy - 10} textAnchor="middle" fontSize={10} fill="#bbb">POST /alerts</text>

        {/* === Webhook === */}
        <rect x={wh.x} y={cy - 35} width={wh.w} height={70} rx={10} fill="#e6f7ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={whCx} y={cy - 8} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={600}>Webhook</text>
        <text x={whCx} y={cy + 12} textAnchor="middle" fontSize={11} fill={dot(health?.status === 'healthy')}>{health ? lbl(health?.status === 'healthy') : '未知'}</text>
        <circle cx={wh.x + 12} cy={cy - 22} r={5} fill={health?.status === 'healthy' ? '#52c41a' : '#bbb'} />

        {/* === Branch lines (Webhook → 3 channels) === */}
        <line x1={wh.x + wh.w} y1={cy - 18} x2={n1.x} y2={n1Cy} stroke="#ddd" strokeWidth={1.5} />
        <line x1={wh.x + wh.w} y1={cy} x2={n2.x} y2={n2Cy} stroke="#ddd" strokeWidth={1.5} />
        <line x1={wh.x + wh.w} y1={cy + 18} x2={n3.x} y2={n3Cy} stroke="#ddd" strokeWidth={1.5} />

        {/* === 邮件/飞书 === */}
        <rect x={n1.x} y={n1Cy - 28} width={n1.w} height={56} rx={10} fill="#f6ffed" stroke={dot(health?.mail_ok)} strokeWidth={1.5} />
        <text x={n1.x + n1.w / 2} y={n1Cy - 5} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>邮件 / 飞书</text>
        <text x={n1.x + n1.w / 2} y={n1Cy + 14} textAnchor="middle" fontSize={10} fill={dot(health?.mail_ok)}>{lbl(health?.mail_ok)}</text>
        <circle cx={n1.x + 12} cy={n1Cy - 18} r={4} fill={dot(health?.mail_ok)} />

        {/* === VM === */}
        <rect x={n2.x} y={n2Cy - 28} width={n2.w} height={56} rx={10} fill="#fff7e6" stroke={dot(health?.vm_ok)} strokeWidth={1.5} />
        <text x={n2.x + n2.w / 2} y={n2Cy - 5} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>VM 落盘</text>
        <text x={n2.x + n2.w / 2} y={n2Cy + 14} textAnchor="middle" fontSize={10} fill={dot(health?.vm_ok)}>{lbl(health?.vm_ok)}</text>
        <circle cx={n2.x + 12} cy={n2Cy - 18} r={4} fill={dot(health?.vm_ok)} />

        {/* === Kafka === */}
        <rect x={n3.x} y={n3Cy - 28} width={n3.w} height={56} rx={10} fill="#f9f0ff" stroke={dot(health?.kafka_ok)} strokeWidth={1.5} />
        <text x={n3.x + n3.w / 2} y={n3Cy - 5} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>Kafka</text>
        <text x={n3.x + n3.w / 2} y={n3Cy + 14} textAnchor="middle" fontSize={10} fill={dot(health?.kafka_ok)}>{lbl(health?.kafka_ok)}</text>
        <circle cx={n3.x + 12} cy={n3Cy - 18} r={4} fill={dot(health?.kafka_ok)} />

        {/* === Output lines (3 channels → destinations) === */}
        <line x1={n1.x + n1.w} y1={n1Cy} x2={dst.x} y2={n1Cy} stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <line x1={n2.x + n2.w} y1={n2Cy} x2={dst.x} y2={n2Cy} stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <line x1={n3.x + n3.w} y2={n3Cy} x2={dst.x} y2={n3Cy} stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />

        {/* === Destinations === */}
        <rect x={dst.x} y={n1Cy - 18} width={dst.w} height={36} rx={6} fill="#fafafa" stroke="#eee" />
        <text x={dst.x + dst.w / 2} y={n1Cy + 4} textAnchor="middle" fontSize={11} fill="#999">Exchange / 飞书 API</text>
        <rect x={dst.x} y={n2Cy - 18} width={dst.w} height={36} rx={6} fill="#fafafa" stroke="#eee" />
        <text x={dst.x + dst.w / 2} y={n2Cy + 4} textAnchor="middle" fontSize={11} fill="#999">VictoriaMetrics</text>
        <rect x={dst.x} y={n3Cy - 18} width={dst.w} height={36} rx={6} fill="#fafafa" stroke="#eee" />
        <text x={dst.x + dst.w / 2} y={n3Cy + 4} textAnchor="middle" fontSize={11} fill="#999">Kafka → Flink → Doris</text>

        {/* === Particles: 3 dots, same start & end timing === */}
        <circle r={4} fill="#1677ff" opacity={0.7}>
          <animateMotion dur="2s" repeatCount="indefinite" begin="0s" path={`M${wh.x + wh.w},${cy - 18} L${n1.x},${n1Cy} L${n1.x + n1.w},${n1Cy} L${dst.x},${n1Cy}`} />
        </circle>
        <circle r={4} fill="#1677ff" opacity={0.7}>
          <animateMotion dur="2s" repeatCount="indefinite" begin="0s" path={`M${wh.x + wh.w},${cy} L${n2.x},${n2Cy} L${n2.x + n2.w},${n2Cy} L${dst.x},${n2Cy}`} />
        </circle>
        <circle r={4} fill="#1677ff" opacity={0.7}>
          <animateMotion dur="2s" repeatCount="indefinite" begin="0s" path={`M${wh.x + wh.w},${cy + 18} L${n3.x},${n3Cy} L${n3.x + n3.w},${n3Cy} L${dst.x},${n3Cy}`} />
        </circle>
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

      <Card title="服务模块" size="small">
        <Table dataSource={[
          { channel: '告警入口', path: 'POST /alerts (Alertmanager webhook)', desc: '接收 Alertmanager 告警推送，去重后分发' },
          { channel: '通知通道', path: 'mail_sender.py + larkMsgCard.py', desc: '邮件 + 飞书卡片通知' },
          { channel: 'VM 落盘', path: 'vm_client.py', desc: '告警事件写入 VictoriaMetrics' },
          { channel: 'Kafka 推送', path: 'KafkaProducer → alert-records', desc: '推送 Kafka，Flink→Doris 消费' },
          { channel: 'Redis 防抖', path: 'Sentinel + state_machine.py', desc: '告警去重/防抖，Sentinel 高可用' },
        ]}
        rowKey="channel" pagination={false} size="middle"
        columns={[
          { title: '模块', dataIndex: 'channel', width: 120, align: 'center' },
          { title: '路径', dataIndex: 'path', width: 280, align: 'center', render: (s: string) => <code style={{ fontSize: 11 }}>{s}</code> },
          { title: '说明', dataIndex: 'desc' },
        ]}
        />
      </Card>
    </div>
  )
}
