import { useEffect, useState, useMemo } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button, Table } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'
import { cacheGet, cacheSet } from '../lib/cache'

const { Title } = Typography

interface PushRecord { alertName: string; instance: string; channel: string; status: string; summary: string; recipient: string; action: string; createdAt: string }

// ... FlowTopo remains unchanged ...


interface NodeInfo { url: string; up: boolean; latency_ms: number | null; stats?: Record<string, number> }
interface HealthData { status: string; nodes?: NodeInfo[]; redis_ok?: boolean; timestamp?: string }

function FlowTopo({ health }: { health: HealthData | null }) {
  const W = 1250; const H = 560
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`

  // Node center X positions
  const pmX = 80; const amX = 260; const whX = 440
  const sendX = 660; const sendW = 120
  const subX = 920; const endX = 1080; const endW = 160


  // Y positions
  const row0 = 140
  const rEmail = 55; const rLark = 140; const rEll = 225
  const rVM = 345; const rKafka = 480

  const up = health?.status === 'up'
  const dot = up ? '#52c41a' : '#bbb'

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        <defs><marker id="ar" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,1 L8,4 L0,7" fill="#bbb" /></marker></defs>

        {/* ===== Prometheus ===== */}
        <rect x={pmX - 55} y={row0 - 22} width={110} height={44} rx={10} fill="#fafafa" stroke="#d9d9d9" strokeWidth={1.5} />
        <text x={pmX} y={row0 + 4} textAnchor="middle" fontSize={12} fill="#999" fontWeight={500}>Prometheus</text>

        {/* Prometheus → Alertmanager */}
        <path d={curve(pmX + 55, row0, amX - 65, row0)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />

        {/* ===== Alertmanager ===== */}
        <rect x={amX - 65} y={row0 - 22} width={130} height={44} rx={10} fill="#f0f5ff" stroke="#2f54eb" strokeWidth={1.5} />
        <text x={amX} y={row0 + 4} textAnchor="middle" fontSize={13} fill="#2f54eb" fontWeight={600}>Alertmanager</text>

        {/* Alertmanager → Webhook */}
        <path d={curve(amX + 65, row0, whX - 55, row0)} fill="none" stroke="#ddd" strokeWidth={2} markerEnd="url(#ar)" />

        {/* ===== Webhook ===== */}
        <rect x={whX - 55} y={row0 - 22} width={110} height={44} rx={10} fill="#e6f7ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={whX} y={row0 + 4} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={600}>告警触发</text>
        <circle cx={whX - 40} cy={row0 - 12} r={4} fill={dot} />

        {/* ===== 告警发送 ===== */}
        <rect x={sendX - sendW / 2} y={row0 - 22} width={sendW} height={44} rx={10} fill="#f6ffed" stroke="#52c41a" strokeWidth={1.5} />
        <text x={sendX} y={row0 + 4} textAnchor="middle" fontSize={13} fill="#52c41a" fontWeight={600}>告警发送</text>

        {/* ===== Branches ===== */}
        <rect x={subX - 65} y={rEmail - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rEmail + 4} textAnchor="middle" fontSize={12} fill="#999" fontWeight={500}>邮件</text>
        <rect x={subX - 65} y={rLark - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rLark + 4} textAnchor="middle" fontSize={12} fill="#999" fontWeight={500}>飞书</text>
        <rect x={subX - 65} y={rEll - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rEll + 4} textAnchor="middle" fontSize={12} fill="#999" fontWeight={500}>…</text>

        {/* VM 落盘 */}
        <rect x={sendX - sendW / 2} y={rVM - 18} width={sendW} height={36} rx={10} fill="#fff7e6" stroke="#fa8c16" strokeWidth={1.5} />
        <text x={sendX} y={rVM + 4} textAnchor="middle" fontSize={12} fill="#fa8c16" fontWeight={600}>VM 落盘</text>
        <rect x={subX - 65} y={rVM - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rVM + 4} textAnchor="middle" fontSize={11} fill="#999">VictoriaMetrics</text>

        {/* 系统写入 */}
        <rect x={sendX - sendW / 2} y={rKafka - 18} width={sendW} height={36} rx={10} fill="#f9f0ff" stroke="#722ed1" strokeWidth={1.5} />
        <text x={sendX} y={rKafka + 4} textAnchor="middle" fontSize={12} fill="#722ed1" fontWeight={600}>系统写入</text>
        <rect x={subX - 65} y={rKafka - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rKafka + 4} textAnchor="middle" fontSize={11} fill="#999">MySql</text>

        {/* ===== Connection lines ===== */}
        {/* Webhook → 告警发送 */}
        <path d={curve(whX + 55, row0, sendX - sendW / 2, row0)} fill="none" stroke="#ddd" strokeWidth={2} markerEnd="url(#ar)" />
        {/* 告警发送 → 3 branches */}
        <path d={curve(sendX + sendW / 2, row0, subX - 65, rEmail)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <path d={curve(sendX + sendW / 2, row0, subX - 65, rLark)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <path d={curve(sendX + sendW / 2, row0, subX - 65, rEll)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        {/* Webhook → VM 落盘 → VictoriaMetrics */}
        <path d={curve(whX + 55, row0 + 18, sendX - sendW / 2, rVM)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <path d={curve(sendX + sendW / 2, rVM, subX - 65, rVM)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        {/* Webhook → 系统写入 → MySql */}
        <path d={curve(whX + 55, row0 + 36, sendX - sendW / 2, rKafka)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <path d={curve(sendX + sendW / 2, rKafka, subX - 65, rKafka)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />

        {/* ===== Particles - 2 per path, alternating, same source = same begin ===== */}
        {/* Webhook → 告警发送 → 3 branches (blue, same begin) */}
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(whX + 55, row0, sendX - sendW / 2, row0)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(whX + 55, row0, sendX - sendW / 2, row0)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(sendX + sendW / 2, row0, subX - 65, rEmail)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(sendX + sendW / 2, row0, subX - 65, rEmail)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(sendX + sendW / 2, row0, subX - 65, rLark)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(sendX + sendW / 2, row0, subX - 65, rLark)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(sendX + sendW / 2, row0, subX - 65, rEll)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(sendX + sendW / 2, row0, subX - 65, rEll)} /></circle>

        {/* 告警发送 → 邮件/飞书/… (green, same begin) */}
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(sendX + sendW / 2, row0, subX - 65, rEmail)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(sendX + sendW / 2, row0, subX - 65, rEmail)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(sendX + sendW / 2, row0, subX - 65, rLark)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(sendX + sendW / 2, row0, subX - 65, rLark)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(sendX + sendW / 2, row0, subX - 65, rEll)} /></circle>
        <circle r={4} fill="#52c41a" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(sendX + sendW / 2, row0, subX - 65, rEll)} /></circle>

        {/* Webhook → VM 落盘 → VictoriaMetrics (orange, same begin) */}
        <circle r={4} fill="#fa8c16" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(whX + 55, row0 + 18, sendX - sendW / 2, rVM)} /></circle>
        <circle r={4} fill="#fa8c16" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(whX + 55, row0 + 18, sendX - sendW / 2, rVM)} /></circle>
        <circle r={4} fill="#fa8c16" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(sendX + sendW / 2, rVM, subX - 65, rVM)} /></circle>
        <circle r={4} fill="#fa8c16" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(sendX + sendW / 2, rVM, subX - 65, rVM)} /></circle>

        {/* Webhook → 系统写入 → MySql (purple, same begin) */}
        <circle r={4} fill="#722ed1" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(whX + 55, row0 + 36, sendX - sendW / 2, rKafka)} /></circle>
        <circle r={4} fill="#722ed1" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(whX + 55, row0 + 36, sendX - sendW / 2, rKafka)} /></circle>
        <circle r={4} fill="#722ed1" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={curve(sendX + sendW / 2, rKafka, subX - 65, rKafka)} /></circle>
        <circle r={4} fill="#722ed1" opacity={0.7}><animateMotion dur="3s" repeatCount="indefinite" begin="3s" path={curve(sendX + sendW / 2, rKafka, subX - 65, rKafka)} /></circle>
      </svg>
    </div>
  )
}

export default function WebhookEvents() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const [pushLog, setPushLog] = useState<PushRecord[]>([])
  const load = async () => { setLoading(true); try { const cached = cacheGet('webhook:health'); if (cached) setHealth(cached); const [{ data: h }, { data: p }] = await Promise.all([api.get('/webhook/health'), api.get('/webhook/push-log', { params: { limit: 20 } })]); setHealth(h); setPushLog(p || []); cacheSet('webhook:health', h) } catch { setHealth(null); setPushLog([]) }; setLoading(false) }
  useEffect(() => { load() }, [])

  const nodes = health?.nodes || []
  const nodeNames = (i: number) => `webhook0${i + 1}`
  const stats = health?.nodes?.reduce((a, n) => {
    if (n.stats) Object.entries(n.stats).forEach(([k, v]) => { a[k] = (a[k] || 0) + (v as number) })
    return a
  }, {} as Record<string, number>) || {}

  const groupedLog = useMemo(() => {
    const map: Record<string, { time: string; alert: string; instance: string; action: string; reason: string; hasEmail: boolean; hasLark: boolean; emailOk: boolean; larkOk: boolean; emailRecipient: string; larkRecipient: string }> = {}
    pushLog.forEach((r) => {
      const key = `${r.alertName}|${r.instance}`
      if (!map[key]) map[key] = { time: r.createdAt, alert: r.alertName, instance: r.instance, action: r.action || r.summary || '', reason: r.summary || '', hasEmail: false, hasLark: false, emailOk: false, larkOk: false, emailRecipient: '', larkRecipient: '' }
      const ok = r.status === 1 || r.status === '1' || r.status === 'success'
      if (r.channel === 'email') { map[key].hasEmail = true; map[key].emailOk = ok; map[key].emailRecipient = r.recipient || '' }
      if (r.channel === 'lark') { map[key].hasLark = true; map[key].larkOk = ok; map[key].larkRecipient = r.recipient || '' }
      if (r.createdAt > map[key].time) map[key].time = r.createdAt
    })
    return Object.values(map).sort((a, b) => b.time.localeCompare(a.time))
  }, [pushLog])

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 8, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>Webhook 告警分发</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>

      <Card size="small" style={{ marginBottom: 16, background: '#fafbfc', overflow: 'auto' }}>
        <FlowTopo health={health} />
      </Card>

      <Card title="告警推送记录" size="small" style={{ marginBottom: 16 }}>
        <Table
          dataSource={groupedLog.length > 0 ? groupedLog : [{ time: '', alert: '', instance: '', reason: '', emailOk: false, larkOk: false, emailRecipient: '', larkRecipient: '' }]}
          rowKey={(r, i) => r.time + i}
          size="middle"
          pagination={false}
          locale={{ emptyText: '暂无推送记录' }}
          columns={[
            { title: '时间', dataIndex: 'time', width: 150, align: 'center', render: (s: string) => s ? new Date(s).toLocaleString() : '—' },
            { title: '告警名称', dataIndex: 'alert', width: 160, render: (s: string) => s || '—' },
            { title: '实例', dataIndex: 'instance', width: 150, render: (s: string) => s || '—' },
            {
              title: '邮件', width: 150,
              render: (_: any, r: typeof groupedLog[0]) => {
                if (!r.hasEmail) return <Tag color="default">未触发</Tag>
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag color={r.emailOk ? 'green' : 'red'} style={{ margin: 0 }}>{r.emailOk ? '成功' : '失败'}</Tag>
                    {r.emailRecipient && <span style={{ fontSize: 12, color: '#999' }}>{r.emailRecipient}</span>}
                  </div>
                )
              },
            },
            {
              title: '飞书', width: 150,
              render: (_: any, r: typeof groupedLog[0]) => {
                if (!r.hasLark) return <Tag color="default">未触发</Tag>
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag color={r.larkOk ? 'green' : 'red'} style={{ margin: 0 }}>{r.larkOk ? '成功' : '失败'}</Tag>
                    {r.larkRecipient && <span style={{ fontSize: 12, color: '#999' }}>{r.larkRecipient}</span>}
                  </div>
                )
              },
            },
            { title: '推送操作', dataIndex: 'action', width: 100, align: 'center' },
            { title: '原因', dataIndex: 'reason', ellipsis: true, width: 200 },
          ]}
        />
      </Card>

      <Card title="集群节点" size="small">
        <Row gutter={16}>
          {nodes.map((n, i) => (
            <Col span={8} key={n.url}>
              <Card size="small">
                <Row justify="space-between" align="middle">
                  <Col><strong>monitor0{i + 1}</strong><Tag style={{ marginLeft: 8 }}>{nodeNames(i)}</Tag></Col>
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
    </div>
  )
}
