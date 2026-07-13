import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button } from 'antd'
import { ReloadOutlined, MailOutlined, SendOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface NodeInfo { url: string; up: boolean; latency_ms: number | null; stats?: Record<string, number> }
interface HealthData { status: string; nodes?: NodeInfo[]; redis_ok?: boolean; timestamp?: string }

function FlowTopo({ health }: { health: HealthData | null }) {
  const W = 1300; const H = 520
  const amCx = 100; const whCx = 320
  const sendCx = 560; const sendW = 130
  const subCx = 800
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`

  // lanes
  const sendCy = 140       // 告警发送 center
  const emailY = 60; const larkY = 140; const ellY = 220
  const vmY = 340; const kafkaY = 440

  const up = health?.status === 'up'

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        <defs><marker id="ar" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,1 L8,4 L0,7" fill="#1677ff" /></marker></defs>

        {/* Alertmanager */}
        <rect x={amCx - 60} y={sendCy - 22} width={120} height={44} rx={10} fill="#f0f5ff" stroke="#2f54eb" strokeWidth={1.5} />
        <text x={amCx} y={sendCy} textAnchor="middle" fontSize={13} fill="#2f54eb" fontWeight={600}>Alertmanager</text>
        <path d={curve(amCx + 60, sendCy, whCx - 60, sendCy)} fill="none" stroke="#1677ff" strokeWidth={2} markerEnd="url(#ar)" />

        {/* Webhook */}
        <rect x={whCx - 55} y={sendCy - 22} width={110} height={44} rx={10} fill="#e6f7ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={whCx} y={sendCy} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={600}>Webhook</text>
        <circle cx={whCx - 40} cy={sendCy - 12} r={4} fill={up ? '#52c41a' : '#bbb'} />

        {/* Webhook → 告警发送 */}
        <path d={curve(whCx + 55, sendCy, sendCx - sendW / 2, sendCy)} fill="none" stroke="#1677ff" strokeWidth={2} markerEnd="url(#ar)" />

        {/* 告警发送 */}
        <rect x={sendCx - sendW / 2} y={sendCy - 22} width={sendW} height={44} rx={10} fill="#f6ffed" stroke="#52c41a" strokeWidth={1.5} />
        <text x={sendCx} y={sendCy} textAnchor="middle" fontSize={13} fill="#333" fontWeight={600}>告警发送</text>

        {/* 告警发送 → 3 sub branches */}
        {[[emailY,'邮件',0], [larkY,'飞书',1], [ellY,'…',2]].map(([y, label, idx]) => (
          <g key={`sub-${idx}`}>
            <path d={curve(sendCx + sendW / 2, sendCy, subCx - 65, Number(y))} fill="none" stroke="#ddd" strokeWidth={1.5} />
            <rect x={subCx - 65} y={Number(y) - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" strokeWidth={1} />
            <text x={subCx} y={Number(y) + 4} textAnchor="middle" fontSize={12} fill="#555" fontWeight={500}>{label}</text>
          </g>
        ))}

        {/* Webhook → VM */}
        <path d={curve(whCx + 55, sendCy + 18, sendCx - sendW / 2, vmY)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        <rect x={sendCx - sendW / 2} y={vmY - 18} width={sendW} height={36} rx={10} fill="#fff7e6" stroke="#fa8c16" strokeWidth={1} />
        <text x={sendCx} y={vmY + 4} textAnchor="middle" fontSize={13} fill="#333" fontWeight={600}>VM 落盘</text>
        <path d={curve(sendCx + sendW / 2, vmY, subCx - 65, vmY)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <rect x={subCx - 65} y={vmY - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" strokeWidth={1} />
        <text x={subCx} y={vmY + 4} textAnchor="middle" fontSize={11} fill="#999">VictoriaMetrics</text>

        {/* Webhook → Kafka */}
        <path d={curve(whCx + 55, sendCy + 36, sendCx - sendW / 2, kafkaY)} fill="none" stroke="#ddd" strokeWidth={1.5} />
        <rect x={sendCx - sendW / 2} y={kafkaY - 18} width={sendW} height={36} rx={10} fill="#f9f0ff" stroke="#722ed1" strokeWidth={1} />
        <text x={sendCx} y={kafkaY + 4} textAnchor="middle" fontSize={13} fill="#333" fontWeight={600}>Kafka 推送</text>
        <path d={curve(sendCx + sendW / 2, kafkaY, subCx - 65, kafkaY)} fill="none" stroke="#ddd" strokeWidth={1.5} markerEnd="url(#ar)" />
        <rect x={subCx - 65} y={kafkaY - 18} width={130} height={36} rx={8} fill="#fafafa" stroke="#e8e8e8" strokeWidth={1} />
        <text x={subCx} y={kafkaY + 4} textAnchor="middle" fontSize={11} fill="#999">Kafka → Doris</text>

        {/* Particles */}
        {[[sendCy, 'main'], [emailY, 'sub0'], [larkY, 'sub1'], [ellY, 'sub2'], [vmY, 'vm'], [kafkaY, 'kf']].map(([y, key], i) => (
          <circle key={key} r={4} fill="#1677ff" opacity={0.6}>
            <animateMotion dur="3s" repeatCount="indefinite" begin={`${i * 0.3}s`} path={`${curve(sendCx + sendW / 2, Number(y), subCx - 65, Number(y))}`} />
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
  const nodeNames = (i: number) => `webhook0${i + 1}`

  const stats = health?.nodes?.reduce((a, n) => {
    if (n.stats) { Object.entries(n.stats).forEach(([k, v]) => { a[k] = (a[k] || 0) + (v as number) }) }
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
        <Row gutter={16}>
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
      </Card>

      <Card title="集群节点" size="small" style={{ marginBottom: 16 }}>
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
