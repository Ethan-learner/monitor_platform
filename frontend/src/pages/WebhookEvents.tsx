import { useEffect, useState } from 'react'
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
  const ok = (v?: boolean) => v === true
  const dot = (v?: boolean) => ok(v) ? '#52c41a' : v === false ? '#ff4d4f' : '#d9d9d9'
  const label = (v?: boolean) => ok(v) ? '在线' : v === false ? '离线' : '未知'

  return (
    <div style={{ overflow: 'auto', padding: '16px 0' }}>
      <svg width={700} height={160} style={{ display: 'block', margin: '0 auto' }}>
        {/* Alertmanager */}
        <rect x={10} y={55} width={100} height={50} rx={6} fill="#f0f5ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={60} y={74} textAnchor="middle" fontSize={11} fill="#333" fontWeight={500}>Alertmanager</text>
        <text x={60} y={90} textAnchor="middle" fontSize={10} fill="#999">告警源</text>

        {/* Arrow */}
        <line x1={110} y1={80} x2={165} y2={80} stroke="#1677ff" strokeWidth={1.5} markerEnd="url(#arr)" />
        <text x={138} y={72} textAnchor="middle" fontSize={9} fill="#999">POST /alerts</text>

        {/* Webhook */}
        <rect x={170} y={55} width={100} height={50} rx={6} fill="#e6f7ff" stroke="#1677ff" strokeWidth={1.5} />
        <text x={220} y={74} textAnchor="middle" fontSize={11} fill="#333" fontWeight={500}>Webhook</text>
        <text x={220} y={90} textAnchor="middle" fontSize={10} fill={dot(health?.status === 'healthy')}>{health ? label(health?.status === 'healthy') : '未知'}</text>
        <circle cx={178} cy={63} r={4} fill={health ? '#52c41a' : '#d9d9d9'} />

        {/* Branch lines */}
        <line x1={270} y1={65} x2={310} y2={45} stroke="#d9d9d9" strokeWidth={1} />
        <line x1={270} y1={80} x2={310} y2={80} stroke="#d9d9d9" strokeWidth={1} />
        <line x1={270} y1={95} x2={310} y2={115} stroke="#d9d9d9" strokeWidth={1} />

        {/* Notify */}
        <rect x={315} y={22} width={100} height={42} rx={6} fill="#f6ffed" stroke="#52c41a" strokeWidth={1} />
        <text x={365} y={40} textAnchor="middle" fontSize={10} fill="#333">邮件 / 飞书</text>
        <text x={365} y={54} textAnchor="middle" fontSize={9} fill={dot(health?.mail_ok)}>{label(health?.mail_ok)}</text>
        <circle cx={323} cy={30} r={3} fill={dot(health?.mail_ok)} />

        {/* VM */}
        <rect x={315} y={62} width={100} height={42} rx={6} fill="#fff7e6" stroke="#fa8c16" strokeWidth={1} />
        <text x={365} y={80} textAnchor="middle" fontSize={10} fill="#333">VM 落盘</text>
        <text x={365} y={94} textAnchor="middle" fontSize={9} fill={dot(health?.vm_ok)}>{label(health?.vm_ok)}</text>
        <circle cx={323} cy={70} r={3} fill={dot(health?.vm_ok)} />

        {/* Kafka */}
        <rect x={315} y={108} width={100} height={42} rx={6} fill="#f0f5ff" stroke="#1677ff" strokeWidth={1} />
        <text x={365} y={126} textAnchor="middle" fontSize={10} fill="#333">Kafka 推送</text>
        <text x={365} y={140} textAnchor="middle" fontSize={9} fill={dot(health?.kafka_ok)}>{label(health?.kafka_ok)}</text>
        <circle cx={323} cy={116} r={3} fill={dot(health?.kafka_ok)} />

        {/* Arrow marker */}
        <defs><marker id="arr" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto"><path d="M0,1 L10,5 L0,9" fill="#1677ff" /></marker></defs>
      </svg>
    </div>
  )
}

export default function WebhookEvents() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/webhook/status')
      setHealth(data)
    } catch { setHealth(null) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const channels = [
    { name: '邮件 / 飞书', key: 'notify', ok: health?.mail_ok && health?.lark_ok, sent: (health?.stats?.email_sent || 0) + (health?.stats?.lark_sent || 0), failed: (health?.stats?.email_failed || 0) + (health?.stats?.lark_failed || 0) },
    { name: 'VM 落盘', key: 'vm', ok: health?.vm_ok, sent: health?.stats?.vm_writes, failed: health?.stats?.vm_failed },
    { name: 'Kafka 推送', key: 'kafka', ok: health?.kafka_ok, sent: health?.stats?.kafka_sent, failed: health?.stats?.kafka_failed },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>Webhook 告警分发</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
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
        <Table
          dataSource={[
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
