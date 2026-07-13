import { useEffect, useState, useRef } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button, Table } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface HealthData {
  status: string; kafka_ok: boolean; redis_ok: boolean; timestamp: string
  mail_ok?: boolean; lark_ok?: boolean; vm_ok?: boolean
  stats?: { email_sent: number; email_failed: number; lark_sent: number; lark_failed: number; vm_writes: number; vm_failed: number; kafka_sent: number; kafka_failed: number }
}

function FlowTopo({ health }: { health: HealthData | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const ok = (v?: boolean) => v === true
  const dot = (v?: boolean) => ok(v) ? '#52c41a' : v === false ? '#ff4d4f' : '#bbb'
  const label = (v?: boolean) => ok(v) ? '正常' : v === false ? '异常' : '未知'

  // Particle animation on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const W = rect.width; const H = rect.height

    // Define flow paths: [startX, startY, endX, endY]
    const paths = [
      [430, 85, 540, 85],   // → notify
      [430, 195, 540, 195],  // → VM
      [430, 305, 540, 305],  // → Kafka
      [230, 155, 430, 85],   // branch → notify
      [230, 195, 430, 195],  // branch → VM
      [230, 235, 430, 305],  // branch → Kafka
    ]

    const particles: Array<{ pathIdx: number; progress: number; speed: number; size: number; alpha: number }> = []
    for (let i = 0; i < 12; i++) {
      particles.push({ pathIdx: i % paths.length, progress: Math.random(), speed: 0.002 + Math.random() * 0.004, size: 2 + Math.random() * 2, alpha: 0.3 + Math.random() * 0.5 })
    }

    let animId: number
    const animate = () => {
      ctx.clearRect(0, 0, W, H)
      // Draw paths (faint)
      paths.forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
        ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 2; ctx.stroke()
      })
      // Draw particles
      particles.forEach((p) => {
        p.progress += p.speed
        if (p.progress > 1) p.progress = 0
        const [x1, y1, x2, y2] = paths[p.pathIdx]
        const px = x1 + (x2 - x1) * p.progress
        const py = y1 + (y2 - y1) * p.progress
        ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(22,119,255,${p.alpha})`; ctx.fill()
      })
      animId = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animId)
  }, [])

  const w = 800; const h = 420
  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'auto' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, pointerEvents: 'none' }} />
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', margin: '0 auto' }}>
        {/* ===== Alertmanager ===== */}
        <rect x={40} y={125} width={130} height={60} rx={10} fill="#f0f5ff" stroke="#1677ff" strokeWidth={2} />
        <text x={105} y={150} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={600}>Alertmanager</text>
        <text x={105} y={170} textAnchor="middle" fontSize={11} fill="#999">告警源</text>

        {/* ===== Arrow to Webhook ===== */}
        <line x1={170} y1={155} x2={250} y2={155} stroke="#1677ff" strokeWidth={2} markerEnd="url(#arrow)" />
        <text x={210} y={145} textAnchor="middle" fontSize={9} fill="#999">webhook POST</text>

        {/* ===== Webhook ===== */}
        <rect x={255} y={120} width={130} height={70} rx={10} fill="#e6f7ff" stroke="#1677ff" strokeWidth={2} />
        <text x={320} y={148} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={600}>Webhook</text>
        <text x={320} y={166} textAnchor="middle" fontSize={11} fill={dot(health?.status === 'healthy')}>{health ? label(health?.status === 'healthy') : '未知'}</text>
        <circle cx={268} cy={133} r={5} fill={health?.status === 'healthy' ? '#52c41a' : '#d9d9d9'} />

        {/* ===== Branch lines from Webhook ===== */}
        <line x1={385} y1={145} x2={440} y2={90} stroke="#d9d9d9" strokeWidth={1.5} />
        <line x1={385} y1={155} x2={440} y2={200} stroke="#d9d9d9" strokeWidth={1.5} />
        <line x1={385} y1={165} x2={440} y2={310} stroke="#d9d9d9" strokeWidth={1.5} />

        {/* ===== Notify ===== */}
        <rect x={445} y={55} width={130} height={70} rx={10} fill="#f6ffed" stroke={dot(health?.mail_ok)} strokeWidth={2} />
        <text x={510} y={82} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>邮件 / 飞书</text>
        <text x={510} y={100} textAnchor="middle" fontSize={10} fill={dot(health?.mail_ok)}>{label(health?.mail_ok)}</text>
        <circle cx={458} cy={70} r={5} fill={dot(health?.mail_ok)} />

        {/* ===== VM ===== */}
        <rect x={445} y={165} width={130} height={70} rx={10} fill="#fff7e6" stroke={dot(health?.vm_ok)} strokeWidth={2} />
        <text x={510} y={192} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>VM 落盘</text>
        <text x={510} y={210} textAnchor="middle" fontSize={10} fill={dot(health?.vm_ok)}>{label(health?.vm_ok)}</text>
        <circle cx={458} cy={180} r={5} fill={dot(health?.vm_ok)} />

        {/* ===== Kafka ===== */}
        <rect x={445} y={275} width={130} height={70} rx={10} fill="#f0f5ff" stroke={dot(health?.kafka_ok)} strokeWidth={2} />
        <text x={510} y={302} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>Kafka 推送</text>
        <text x={510} y={320} textAnchor="middle" fontSize={10} fill={dot(health?.kafka_ok)}>{label(health?.kafka_ok)}</text>
        <circle cx={458} cy={290} r={5} fill={dot(health?.kafka_ok)} />

        {/* ===== Arrow destinations ===== */}
        <line x1={575} y1={90} x2={640} y2={90} stroke="#d9d9d9" strokeWidth={1.5} />
        <line x1={575} y1={200} x2={640} y2={200} stroke="#d9d9d9" strokeWidth={1.5} />
        <line x1={575} y1={310} x2={640} y2={310} stroke="#d9d9d9" strokeWidth={1.5} />

        {/* ===== Dest labels ===== */}
        <rect x={645} y={70} width={100} height={40} rx={8} fill="#fafafa" stroke="#e8e8e8" strokeWidth={1} />
        <text x={695} y={93} textAnchor="middle" fontSize={10} fill="#999">Exchange / 飞书</text>
        <rect x={645} y={180} width={100} height={40} rx={8} fill="#fafafa" stroke="#e8e8e8" strokeWidth={1} />
        <text x={695} y={203} textAnchor="middle" fontSize={10} fill="#999">VictoriaMetrics</text>
        <rect x={645} y={290} width={100} height={40} rx={8} fill="#fafafa" stroke="#e8e8e8" strokeWidth={1} />
        <text x={695} y={313} textAnchor="middle" fontSize={10} fill="#999">Kafka → Doris</text>

        {/* ===== Redis label below webhook ===== */}
        <text x={320} y={240} textAnchor="middle" fontSize={10} fill="#bbb">Redis Sentinel (防抖/状态)</text>

        {/* Arrow marker */}
        <defs><marker id="arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto"><path d="M0,1 L10,5 L0,9" fill="#1677ff" /></marker></defs>
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
