import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button, Table } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface HealthData {
  status: string; kafka_ok: boolean; redis_ok: boolean; timestamp: string
  mail_ok?: boolean; lark_ok?: boolean; vm_ok?: boolean
  stats?: { email_sent: number; email_failed: number; lark_sent: number; lark_failed: number; vm_writes: number; vm_failed: number }
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
    { name: '邮件', ok: health?.mail_ok, sent: health?.stats?.email_sent, failed: health?.stats?.email_failed },
    { name: '飞书', ok: health?.lark_ok, sent: health?.stats?.lark_sent, failed: health?.stats?.lark_failed },
    { name: 'VM 落盘', ok: health?.vm_ok, sent: health?.stats?.vm_writes, failed: health?.stats?.vm_failed },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>Webhook 告警分发事件</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic title="服务状态" value={health ? '运行中' : '不可达'}
              prefix={health ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />} />
          </Col>
          <Col span={6}>
            <Statistic title="Redis" value={health?.redis_ok ? '正常' : health ? '异常' : '-'}
              valueStyle={{ color: health?.redis_ok ? '#52c41a' : '#ff4d4f' }} />
          </Col>
          <Col span={6}>
            <Statistic title="Kafka" value={health?.kafka_ok ? '正常' : health ? '异常' : '-'}
              valueStyle={{ color: health?.kafka_ok ? '#52c41a' : '#ff4d4f' }} />
          </Col>
          <Col span={6}>
            <Statistic title="更新时间" value={health?.timestamp ? health.timestamp.substring(11, 19) : '-'} />
          </Col>
        </Row>
      </Card>

      <Card title="分发通道" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          {channels.map((ch) => (
            <Col span={8} key={ch.name}>
              <Card size="small" style={{ marginBottom: 8 }}>
                <Row justify="space-between" align="middle">
                  <Col><strong>{ch.name}</strong></Col>
                  <Col>
                    {ch.ok === true && <Tag color="green">正常</Tag>}
                    {ch.ok === false && <Tag color="red">异常</Tag>}
                    {ch.ok === undefined && <Tag>未接入</Tag>}
                  </Col>
                </Row>
                {ch.sent !== undefined && (
                  <Row gutter={12} style={{ marginTop: 8 }}>
                    <Col span={12}><Statistic title="成功" value={ch.sent ?? '-'} valueStyle={{ color: '#52c41a', fontSize: 20 }} /></Col>
                    <Col span={12}><Statistic title="失败" value={ch.failed ?? '-'} valueStyle={{ color: '#ff4d4f', fontSize: 20 }} /></Col>
                  </Row>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="服务说明">
        <Table
          dataSource={[
            { channel: '告警入口', path: 'POST /alerts (Alertmanager webhook)', desc: '接收 Alertmanager 告警推送，去重后分发' },
            { channel: '邮件 (Exchange)', path: 'mail_sender.py', desc: 'SMTP 邮件通知，触发/恢复/提醒均发送' },
            { channel: '飞书卡片', path: 'larkMsgCard.py', desc: '飞书模板消息，仅触发/提醒时发送' },
            { channel: 'VM 落盘', path: 'vm_client.py', desc: '告警事件写入 VictoriaMetrics，供 Grafana 查询' },
            { channel: 'Kafka 推送', path: 'KafkaProducer → alert-records', desc: '推送到 Kafka，Flink 消费写入 Doris' },
            { channel: 'Redis 防抖', path: 'Sentinel + state_machine.py', desc: '告警去重/防抖/持续提醒，Sentinel 高可用' },
          ]}
          rowKey="channel" pagination={false} size="middle"
          columns={[
            { title: '模块', dataIndex: 'channel', width: 140 },
            { title: '路径', dataIndex: 'path', width: 260, render: (s: string) => <code style={{ fontSize: 12 }}>{s}</code> },
            { title: '说明', dataIndex: 'desc' },
          ]}
        />
      </Card>
    </div>
  )
}
