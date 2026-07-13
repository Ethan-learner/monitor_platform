import { useEffect, useState, useRef } from 'react'
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

  // Node positions
  const am = { x: 50, y: 170, w: 120, h: 60 }          // Alertmanager
  const wh = { x: 230, y: 165, w: 110, h: 70 }          // Webhook
  const notify = { x: 440, y: 45, w: 130, h: 70 }       // 邮件/飞书
  const vm = { x: 440, y: 145, w: 130, h: 70 }          // VM
  const kafka = { x: 440, y: 245, w: 130, h: 70 }       // Kafka
  const dst = { x: 650, y1: 48, y2: 148, y3: 248, w: 130, h: 40 } // Destinations

  const W = 810; const H = 380
  const amCx = am.x + am.w / 2; const amCy = am.y + am.h / 2
  const whCx = wh.x + wh.w / 2; const whCy = wh.y + wh.h / 2
  const nCx = notify.x + notify.w / 2; const nCy = notify.y + notify.h / 2
  const vCx = vm.x + vm.w / 2; const vCy = vm.y + vm.h / 2
  const kCx = kafka.x + kafka.w / 2; const kCy = kafka.y + kafka.h / 2

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto"><path d="M0,2 L10,5 L0,8" fill="#1677ff" /></marker>
          <style>{'.pulse{animation:pulse 2s ease-in-out infinite}.dot1{animation:dot1 3s linear infinite}.dot2{animation:dot2 3.5s linear infinite}.dot3{animation:dot3 4s linear infinite}@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}@keyframes dot1{0%{transform:translate(0,0)}100%{transform:translate(140,0)}}@keyframes dot2{0%{transform:translate(0,0)}100%{transform:translate(140,0)}}@keyframes dot3{0%{transform:translate(0,0)}100%{transform:translate(140,0)}}'}</style>
        </defs>

        {/* ===== Alertmanager ===== */}
        <rect x={am.x} y={am.y} width={am.w} height={am.h} rx={10} fill="#f0f5ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={amCx} y={amCy - 4} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={600}>Alertmanager</text>
        <text x={amCx} y={amCy + 16} textAnchor="middle" fontSize={11} fill="#999">告警源</text>

        {/* Webhook connection */}
        <line x1={am.x + am.w} y1={amCy} x2={wh.x} y2={whCy} stroke="#1677ff" strokeWidth={2} markerEnd="url(#arr)" />
        <text x={180} y={amCy - 10} textAnchor="middle" fontSize={9} fill="#999">POST /alerts</text>

        {/* ===== Webhook ===== */}
        <rect x={wh.x} y={wh.y} width={wh.w} height={wh.h} rx={10} fill="#e6f7ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={whCx} y={whCy - 4} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={600}>Webhook</text>
        <text x={whCx} y={whCy + 16} textAnchor="middle" fontSize={11} fill={dot(health?.status === 'healthy')}>{health ? (health.status === 'healthy' ? '运行中' : '异常') : '未知'}</text>
        <circle cx={wh.x + 14} cy={wh.y + 14} r={5} fill={health?.status === 'healthy' ? '#52c41a' : '#d9d9d9'} />

        {/* ===== Distribution lines ===== */}
        <line x1={wh.x + wh.w} y1={whCy - 20} x2={notify.x} y2={nCy} stroke="#e0e0e0" strokeWidth={1.5} />
        <line x1={wh.x + wh.w} y1={whCy} x2={vm.x} y2={vCy} stroke="#e0e0e0" strokeWidth={1.5} />
        <line x1={wh.x + wh.w} y1={whCy + 20} x2={kafka.x} y2={kCy} stroke="#e0e0e0" strokeWidth={1.5} />

        {/* ===== Notify ===== */}
        <rect x={notify.x} y={notify.y} width={notify.w} height={notify.h} rx={10} fill="#f6ffed" stroke={dot(health?.mail_ok)} strokeWidth={1.5} />
        <text x={nCx} y={nCy - 4} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>邮件 / 飞书</text>
        <text x={nCx} y={nCy + 14} textAnchor="middle" fontSize={10} fill={dot(health?.mail_ok)}>{health?.mail_ok === true ? '正常' : health?.mail_ok === false ? '异常' : '未知'}</text>
        <circle cx={notify.x + 12} cy={notify.y + 12} r={4} fill={dot(health?.mail_ok)} />

        {/* ===== VM ===== */}
        <rect x={vm.x} y={vm.y} width={vm.w} height={vm.h} rx={10} fill="#fff7e6" stroke={dot(health?.vm_ok)} strokeWidth={1.5} />
        <text x={vCx} y={vCy - 4} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>VM 落盘</text>
        <text x={vCx} y={vCy + 14} textAnchor="middle" fontSize={10} fill={dot(health?.vm_ok)}>{health?.vm_ok === true ? '正常' : health?.vm_ok === false ? '异常' : '未知'}</text>
        <circle cx={vm.x + 12} cy={vm.y + 12} r={4} fill={dot(health?.vm_ok)} />

        {/* ===== Kafka ===== */}
        <rect x={kafka.x} y={kafka.y} width={kafka.w} height={kafka.h} rx={10} fill="#f0f5ff" stroke={dot(health?.kafka_ok)} strokeWidth={1.5} />
        <text x={kCx} y={kCy - 4} textAnchor="middle" fontSize={12} fill="#333" fontWeight={600}>Kafka 推送</text>
        <text x={kCx} y={kCy + 14} textAnchor="middle" fontSize={10} fill={dot(health?.kafka_ok)}>{health?.kafka_ok === true ? '正常' : health?.kafka_ok === false ? '异常' : '未知'}</text>
        <circle cx={kafka.x + 12} cy={kafka.y + 12} r={4} fill={dot(health?.kafka_ok)} />

        {/* ===== Output lines to destinations ===== */}
        <line x1={notify.x + notify.w} y1={nCy} x2={dst.x} y2={dst.y1 + dst.h / 2} stroke="#e0e0e0" strokeWidth={1.5} markerEnd="url(#arr)" />
        <line x1={vm.x + vm.w} y1={vCy} x2={dst.x} y2={dst.y2 + dst.h / 2} stroke="#e0e0e0" strokeWidth={1.5} markerEnd="url(#arr)" />
        <line x1={kafka.x + kafka.w} y1={kCy} x2={dst.x} y2={dst.y3 + dst.h / 2} stroke="#e0e0e0" strokeWidth={1.5} markerEnd="url(#arr)" />

        {/* ===== Destination labels ===== */}
        <rect x={dst.x} y={dst.y1} width={dst.w} height={dst.h} rx={6} fill="#fafafa" stroke="#eee" strokeWidth={1} />
        <text x={dst.x + dst.w / 2} y={dst.y1 + dst.h / 2 + 4} textAnchor="middle" fontSize={11} fill="#999">Exchange / 飞书</text>
        <rect x={dst.x} y={dst.y2} width={dst.w} height={dst.h} rx={6} fill="#fafafa" stroke="#eee" strokeWidth={1} />
        <text x={dst.x + dst.w / 2} y={dst.y2 + dst.h / 2 + 4} textAnchor="middle" fontSize={11} fill="#999">VictoriaMetrics</text>
        <rect x={dst.x} y={dst.y3} width={dst.w} height={dst.h} rx={6} fill="#fafafa" stroke="#eee" strokeWidth={1} />
        <text x={dst.x + dst.w / 2} y={dst.y3 + dst.h / 2 + 4} textAnchor="middle" fontSize={11} fill="#999">Kafka → Doris</text>

        {/* ===== Flow particles (single dot per path) ===== */}
        <circle r={3} fill="#1677ff" opacity={0.6}>
          <animateMotion dur="2s" repeatCount="indefinite" path={`M${wh.x + wh.w},${whCy - 20} L${notify.x},${nCy}`} />
        </circle>
        <circle r={3} fill="#1677ff" opacity={0.6}>
          <animateMotion dur="2.5s" repeatCount="indefinite" begin="0.5s" path={`M${wh.x + wh.w},${whCy} L${vm.x},${vCy}`} />
        </circle>
        <circle r={3} fill="#1677ff" opacity={0.6}>
          <animateMotion dur="3s" repeatCount="indefinite" begin="1s" path={`M${wh.x + wh.w},${whCy + 20} L${kafka.x},${kCy}`} />
        </circle>

        {/* ===== Redis ===== */}
        <text x={whCx} y={wh.y + wh.h + 30} textAnchor="middle" fontSize={10} fill="#ccc">Redis Sentinel · 告警防抖/状态管理</text>
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
