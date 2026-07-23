import { useEffect, useState } from 'react'
import { Card, Button, Tag, Space, Typography, Form, Input, Select, Statistic, Row, Col, message, Table, Modal } from 'antd'
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title, Text } = Typography

interface Health { status: string; latencyMs: number | null; code: number | null }

export default function WebhookManage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [resendOpen, setResendOpen] = useState(false)
  const [testForm] = Form.useForm()
  const [resendForm] = Form.useForm()
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const h = await api.get('/webhook/health')
      setHealth(h.data)
    } catch { setHealth({ status: 'down', latencyMs: null, code: null }) }
    try {
      const s = await api.get('/webhook/status')
      setStatus(s.data?.data || s.data)
    } catch { setStatus(null) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleTest = async (values: any) => {
    setSending(true)
    try {
      await api.post('/webhook/test', values)
      message.success('测试告警已发送')
      setTestOpen(false); testForm.resetFields()
    } catch (e: any) { message.error(e?.response?.data?.detail || '发送失败') }
    finally { setSending(false) }
  }
  const handleResend = async (values: any) => {
    setSending(true)
    try {
      await api.post('/webhook/resend', values)
      message.success('告警已重发')
      setResendOpen(false); resendForm.resetFields()
    } catch (e: any) { message.error(e?.response?.data?.detail || '重发失败') }
    finally { setSending(false) }
  }

  const services = Array.isArray(status) ? status : (status?.services || [])
  const stats = status?.stats || status?.metrics || {}

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>Webhook 告警分发</Title>
        <Space>
          <Button icon={<PlayCircleOutlined />} onClick={() => setTestOpen(true)}>测试告警</Button>
          <Button icon={<SendOutlined />} onClick={() => setResendOpen(true)}>重发告警</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Statistic
              title="服务状态"
              value={health?.status === 'up' ? '正常' : health?.status === 'down' ? '异常' : '-'}
              prefix={health?.status === 'up' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Col>
          <Col span={6}>
            <Statistic title="响应延迟" value={health?.latencyMs ?? '-'} suffix="ms" />
          </Col>
          <Col span={6}>
            <Statistic title="HTTP 状态码" value={health?.code ?? '-'} />
          </Col>
          <Col span={6}>
            <Text type="secondary">服务地址: {window.location.protocol}//{import.meta.env.VITE_API_TARGET || 'localhost:8000'} → webhook</Text>
          </Col>
        </Row>
      </Card>

      {Object.keys(stats).length > 0 && (
        <Card title="运行指标" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            {Object.entries(stats).map(([k, v]) => (
              <Col span={6} key={k} style={{ marginBottom: 12 }}>
                <Statistic title={k} value={typeof v === 'number' ? v : String(v)} />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {services.length > 0 && (
        <Card title="子服务状态" style={{ marginBottom: 16 }}>
          <Table
            rowKey="name"
            dataSource={services}
            size="middle"
            pagination={false}
            columns={[
              { title: '服务', dataIndex: 'name', width: 150, align: 'center' },
              { title: '状态', dataIndex: 'status', width: 100, align: 'center', render: (s) => <Tag color={s === 'up' ? 'green' : 'red'}>{s}</Tag> },
              { title: '延迟', dataIndex: 'latencyMs', width: 100, align: 'center', render: (v) => v != null ? `${v}ms` : '-' },
              { title: '详情', dataIndex: 'detail' },
            ]}
          />
        </Card>
      )}

      <Modal title="测试告警" open={testOpen} onCancel={() => setTestOpen(false)} footer={null}>
        <Form form={testForm} layout="vertical" onFinish={handleTest} initialValues={{ receiver: 'email', severity: 'warning', summary: '[测试] 平台手动测试告警' }}>
          <Form.Item label="接收方" name="receiver" rules={[{ required: true }]}>
            <Select options={[{ label: '邮件', value: 'email' }, { label: '飞书', value: 'lark' }, { label: '全部', value: 'all' }]} />
          </Form.Item>
          <Form.Item label="级别" name="severity"><Select options={['info', 'warning', 'critical'].map(v => ({ label: v, value: v }))} /></Form.Item>
          <Form.Item label="摘要" name="summary"><Input /></Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={sending}>发送</Button><Button onClick={() => setTestOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>

      <Modal title="重发告警" open={resendOpen} onCancel={() => setResendOpen(false)} footer={null}>
        <Form form={resendForm} layout="vertical" onFinish={handleResend} initialValues={{ receiver: 'all' }}>
          <Form.Item label="告警 fingerprint" name="fingerprint" rules={[{ required: true }]}>
            <Input placeholder="alertmanager 的告警 fingerprint" />
          </Form.Item>
          <Form.Item label="接收方" name="receiver">
            <Select options={[{ label: '全部', value: 'all' }, { label: '邮件', value: 'email' }, { label: '飞书', value: 'lark' }]} />
          </Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={sending}>重发</Button><Button onClick={() => setResendOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}
