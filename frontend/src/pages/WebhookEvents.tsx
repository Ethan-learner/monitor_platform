import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button, Table } from 'antd'
import { ReloadOutlined, MailOutlined, SendOutlined } from '@ant-design/icons'
import { api } from '../lib/api'
import { cacheGet, cacheSet } from '../lib/cache'

const { Title } = Typography

interface NodeInfo { url: string; up: boolean; latency_ms: number | null; stats?: Record<string, number> }
interface HealthData { status: string; nodes?: NodeInfo[]; redis_ok?: boolean; timestamp?: string }

function FlowTopo({ health }: { health: HealthData | null }) {
  const W = 1250; const H = 560
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`

  // Node center X positions - equal spacing between each pair
  // Node center X positions - all gaps ~180px
  const pmX = 80; const amX = 260; const whX = 440
  const sendX = 660; const sendW = 120
  const subX = 920; const endX = 1080; const endW = 160

  // Y positions
  const row0 = 140  // main line: prometheus(center), webhook, 告警发送 center
  const rEmail = 55; const rLark = 140; const rEll = 225  // 告警发送 branches
  const rVM = 345; const rKafka = 480                     // VM / Kafka

  const ok = (v?: boolean) => v === true
  const up = health?.status === 'up'
  const dot = up ? '#52c41a' : '#bbb'

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        <defs><marker id="ar" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,1 L8,4 L0,7" fill="#1677ff" /></marker></defs>

        {/* ===== Prometheus ===== */}
        <rect x={pmX - 55} y={row0 - 22} width={110} height={44} rx={10} fill="#fafafa" stroke="#d9d9d9" strokeWidth={1.5} />
        <text x={pmX} y={row0 + 4} textAnchor="middle" fontSize={12} fill="#999" fontWeight={500}>Prometheus</text>

        {/* Prometheus → Alertmanager */}
        <path d={curve(pmX + 55, row0, amX - 65, row0)} fill="none" stroke="#bbb" strokeWidth={1.5} markerEnd="url(#ar)" />

        {/* ===== Alertmanager ===== */}
        <rect x={amX - 65} y={row0 - 22} width={130} height={44} rx={10} fill="#f0f5ff" stroke="#2f54eb" strokeWidth={1.5} />
        <text x={amX} y={row0 + 4} textAnchor="middle" fontSize={13} fill="#2f54eb" fontWeight={600}>Alertmanager</text>

        {/* Alertmanager → Webhook */}
        <path d={curve(amX + 65, row0, whX - 55, row0)} fill="none" stroke="#1677ff" strokeWidth={2} markerEnd="url(#ar)" />

        {/* ===== Webhook ===== */}
        <rect x={whX - 55} y={row0 - 22} width={110} height={44} rx={10} fill="#e6f7ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={whX} y={row0 + 4} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={600}>Webhook</text>
        <circle cx={whX - 40} cy={row0 - 12} r={4} fill={dot} />

        {/* Webhook → 告警发送 */}
        <path d={curve(whX + 55, row0, sendX - sendW / 2, row0)} fill="none" stroke="#1677ff" strokeWidth={2} markerEnd="url(#ar)" />

        {/* ===== 告警发送 ===== */}
        <rect x={sendX - sendW / 2} y={row0 - 22} width={sendW} height={44} rx={10} fill="#f6ffed" stroke="#52c41a" strokeWidth={1.5} />
        <text x={sendX} y={row0 + 4} textAnchor="middle" fontSize={13} fill="#333" fontWeight={600}>告警发送</text>

        {/* ===== 告警发送 → 3 branches + VM + Kafka ===== */}
        {/* Branch 1: 邮件 */}
        <path d={curve(sendX + sendW / 2, row0, subX - 65, rEmail)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        <rect x={subX - 65} y={rEmail - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rEmail + 4} textAnchor="middle" fontSize={12} fill="#555">邮件</text>
        <path d={curve(subX + 65, rEmail, endX, rEmail)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <rect x={endX} y={rEmail - 18} width={endW} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={endX + endW / 2} y={rEmail + 4} textAnchor="middle" fontSize={11} fill="#999">Exchange SMTP</text>

        {/* Branch 2: 飞书 */}
        <path d={curve(sendX + sendW / 2, row0, subX - 65, rLark)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        <rect x={subX - 65} y={rLark - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rLark + 4} textAnchor="middle" fontSize={12} fill="#555">飞书</text>
        <path d={curve(subX + 65, rLark, endX, rLark)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <rect x={endX} y={rLark - 18} width={endW} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={endX + endW / 2} y={rLark + 4} textAnchor="middle" fontSize={11} fill="#999">飞书 API</text>

        {/* Branch 3: … */}
        <path d={curve(sendX + sendW / 2, row0, subX - 65, rEll)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        <rect x={subX - 65} y={rEll - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rEll + 4} textAnchor="middle" fontSize={12} fill="#555">…</text>
        <path d={curve(subX + 65, rEll, endX, rEll)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <rect x={endX} y={rEll - 18} width={endW} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={endX + endW / 2} y={rEll + 4} textAnchor="middle" fontSize={11} fill="#999">预留扩展</text>

        {/* VM 落盘 */}
        <path d={curve(whX + 55, row0 + 18, sendX - sendW / 2, rVM)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        <rect x={sendX - sendW / 2} y={rVM - 18} width={sendW} height={36} rx={10} fill="#fff7e6" stroke="#fa8c16" strokeWidth={1} />
        <text x={sendX} y={rVM + 4} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>VM 落盘</text>
        <path d={curve(sendX + sendW / 2, rVM, subX - 65, rVM)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <rect x={subX - 65} y={rVM - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rVM + 4} textAnchor="middle" fontSize={11} fill="#999">VictoriaMetrics</text>

        {/* Kafka 推送 */}
        <path d={curve(whX + 55, row0 + 36, sendX - sendW / 2, rKafka)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        <rect x={sendX - sendW / 2} y={rKafka - 18} width={sendW} height={36} rx={10} fill="#f9f0ff" stroke="#722ed1" strokeWidth={1} />
        <text x={sendX} y={rKafka + 4} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>Kafka 推送</text>
        <path d={curve(sendX + sendW / 2, rKafka, subX - 65, rKafka)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <rect x={subX - 65} y={rKafka - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" />
        <text x={subX} y={rKafka + 4} textAnchor="middle" fontSize={11} fill="#999">Kafka → Doris</text>

        {/* ===== Particles (each follows its own exact path) ===== */}
        <circle r={4} fill="#1677ff" opacity={0.6}><animateMotion dur="2.5s" repeatCount="indefinite" begin="0s" path={`${curve(sendX + sendW / 2, row0, subX - 65, rEmail)}`} /></circle>
        <circle r={4} fill="#1677ff" opacity={0.6}><animateMotion dur="2.5s" repeatCount="indefinite" begin="0s" path={`${curve(sendX + sendW / 2, row0, subX - 65, rLark)}`} /></circle>
        <circle r={4} fill="#1677ff" opacity={0.6}><animateMotion dur="2.5s" repeatCount="indefinite" begin="0s" path={`${curve(sendX + sendW / 2, row0, subX - 65, rEll)}`} /></circle>
        <circle r={4} fill="#fa8c16" opacity={0.6}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={`${curve(whX + 55, row0 + 18, sendX - sendW / 2, rVM)} ${curve(sendX + sendW / 2, rVM, subX - 65, rVM)}`} /></circle>
        <circle r={4} fill="#722ed1" opacity={0.6}><animateMotion dur="3s" repeatCount="indefinite" begin="0s" path={`${curve(whX + 55, row0 + 36, sendX - sendW / 2, rKafka)} ${curve(sendX + sendW / 2, rKafka, subX - 65, rKafka)}`} /></circle>
      </svg>
    </div>
  )
}

export default function WebhookEvents() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const load = async () => { setLoading(true); try { const cached = cacheGet('webhook:health'); if (cached) setHealth(cached); const { data } = await api.get('/webhook/health'); setHealth(data); cacheSet('webhook:health', data) } catch { setHealth(null) }; setLoading(false) }
  useEffect(() => { load() }, [])

  const nodes = health?.nodes || []
  const nodeNames = (i: number) => `webhook0${i + 1}`
  const stats = health?.nodes?.reduce((a, n) => {
    if (n.stats) Object.entries(n.stats).forEach(([k, v]) => { a[k] = (a[k] || 0) + (v as number) })
    return a
  }, {} as Record<string, number>) || {}

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
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={12}>
            <Card size="small"><Row gutter={12}>
              <Col span={12}><Statistic title="邮件推送" prefix={<MailOutlined />} value={stats.email_sent || 0} suffix="条" valueStyle={{ color: '#1677ff', fontSize: 22 }} /></Col>
              <Col span={12}><Statistic title="邮件失败" value={stats.email_failed || 0} suffix="条" valueStyle={{ color: '#ff4d4f', fontSize: 22 }} /></Col>
            </Row></Card>
          </Col>
          <Col span={12}>
            <Card size="small"><Row gutter={12}>
              <Col span={12}><Statistic title="飞书推送" prefix={<SendOutlined />} value={stats.lark_sent || 0} suffix="条" valueStyle={{ color: '#1677ff', fontSize: 22 }} /></Col>
              <Col span={12}><Statistic title="飞书失败" value={stats.lark_failed || 0} suffix="条" valueStyle={{ color: '#ff4d4f', fontSize: 22 }} /></Col>
            </Row></Card>
          </Col>
        </Row>
        <Table
          dataSource={[
            { time: '—', channel: '—', alert: '—', status: '—', detail: '元数据库接入后展示推送明细' },
          ]}
          rowKey="time"
          size="small"
          pagination={false}
          locale={{ emptyText: '元数据库接入后展示推送明细' }}
          columns={[
            { title: '时间', dataIndex: 'time', width: 150, align: 'center' },
            { title: '通道', dataIndex: 'channel', width: 80, align: 'center', render: (s: string) => <Tag>{s}</Tag> },
            { title: '告警', dataIndex: 'alert', width: 180 },
            { title: '状态', dataIndex: 'status', width: 80, align: 'center', render: (s: string) => <Tag color={s === '成功' ? 'green' : 'red'}>{s}</Tag> },
            { title: '详情', dataIndex: 'detail' },
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
