import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Tag, Typography, Space, Button, Table } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface HealthData {
  status: string; kafka_ok: boolean; redis_ok: boolean; timestamp: string
}

export default function WebhookEvents() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/webhook/status')
      setHealth(data?.data || data)
    } catch { setHealth(null) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>Webhook 告警分发事件</Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic
              title="服务状态"
              value={health ? '运行中' : '不可达'}
              prefix={health ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Redis 连接"
              value={health?.redis_ok ? '正常' : health ? '异常' : '-'}
              valueStyle={{ color: health?.redis_ok ? '#52c41a' : '#ff4d4f' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Kafka 连接"
              value={health?.kafka_ok ? '正常' : health ? '异常' : '-'}
              valueStyle={{ color: health?.kafka_ok ? '#52c41a' : '#ff4d4f' }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="更新时间" value={health?.timestamp ? health.timestamp.substring(11, 19) : '-'} />
          </Col>
        </Row>
      </Card>

      <Card title="分发通道说明" size="small">
        <Table
          dataSource={[
            { channel: '邮件 (Exchange)', path: 'mail_sender.py', desc: 'SMTP 邮件通知，告警触发/恢复/持续提醒' },
            { channel: '飞书卡片', path: 'larkMsgCard.py', desc: '飞书模板消息，仅触发/提醒时发送' },
            { channel: 'VictoriaMetrics 落盘', path: 'infra/vm_client.py', desc: '告警事件时序化写入 VM，供 Grafana 查询' },
            { channel: 'Kafka 推送', path: 'infra/notifier.py → KafkaProducer', desc: '推送到 alert-records topic，供 Flink→Doris 消费' },
            { channel: 'Redis 状态管理', path: 'infra/state_machine.py + Sentinel', desc: '告警防抖/去重/状态机，Sentinel 高可用' },
          ]}
          rowKey="channel"
          pagination={false}
          size="middle"
          columns={[
            { title: '通道', dataIndex: 'channel', width: 160 },
            { title: '模块', dataIndex: 'path', width: 220, render: (s: string) => <code style={{ fontSize: 12 }}>{s}</code> },
            { title: '说明', dataIndex: 'desc' },
          ]}
        />
      </Card>
    </div>
  )
}
