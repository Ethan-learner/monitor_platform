import { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message, Typography, Row, Col, Statistic } from 'antd'
import { LoginOutlined, UserOutlined, LockOutlined, CloudServerOutlined, WarningOutlined, CheckCircleOutlined, ApiOutlined } from '@ant-design/icons'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

const { Title, Text } = Typography

export default function Login() {
  const { isAuthenticated, init } = useAuthStore()
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  // Simulated stats for visual display
  const stats = [
    { icon: <CloudServerOutlined />, label: '监控节点', value: '128', color: '#1677ff' },
    { icon: <CheckCircleOutlined />, label: '今日告警', value: '12', color: '#52c41a' },
    { icon: <WarningOutlined />, label: '未处理', value: '3', color: '#fa8c16' },
    { icon: <ApiOutlined />, label: '服务可用率', value: '99.97%', color: '#13c2c2' },
  ]

  const handleFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', values)
      await init()
      message.success(`欢迎回来，${data.displayName}`)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '登录失败')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0d1117', position: 'relative' }}>
      {/* Subtle grid background */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'radial-gradient(circle, #58a6ff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* Left side - Dashboard/Stats Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 60px' }}>
        <div style={{ marginBottom: 48 }}>
          <Title level={2} style={{ color: '#f0f6fc', margin: 0, letterSpacing: 1 }}>统一监控门户</Title>
          <Text style={{ color: '#8b949e', fontSize: 14 }}>Unified Monitoring Platform</Text>
        </div>

        <Row gutter={[20, 20]} style={{ maxWidth: 520 }}>
          {stats.map((s, i) => (
            <Col span={12} key={i}>
              <Card size="small" style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8 }}
                bodyStyle={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 24, color: s.color }}>{s.icon}</div>
                  <Statistic title={<span style={{ color: '#8b949e', fontSize: 12 }}>{s.label}</span>}
                    value={s.value} valueStyle={{ color: '#f0f6fc', fontSize: 22, fontWeight: 600 }} />
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <div style={{ marginTop: 32, padding: '16px 20px', background: '#161b22', border: '1px solid #21262d', borderRadius: 8, maxWidth: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: '#8b949e', fontSize: 12 }}>服务状态</Text>
            <Text style={{ color: '#52c41a', fontSize: 11 }}>All Systems Normal</Text>
          </div>
          {['Prometheus', 'VictoriaMetrics', 'Alertmanager', 'Grafana', 'PMM', 'Glowroot'].map(s => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <Text style={{ color: '#c9d1d9', fontSize: 12 }}>{s}</Text>
              <Text style={{ color: '#52c41a', fontSize: 11 }}>● 运行中</Text>
            </div>
          ))}
        </div>
      </div>

      {/* Right side - Login Card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}>
        <Card style={{ width: 380, borderRadius: 12, border: '1px solid #30363d', background: '#161b22', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, background: '#1677ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ApiOutlined style={{ color: '#fff', fontSize: 20 }} />
              </div>
            </div>
            <Text style={{ color: '#f0f6fc', fontSize: 16, fontWeight: 600 }}>用户登录</Text>
            <div style={{ marginTop: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>请输入账号密码登录系统</Text></div>
          </div>

          <Form onFinish={handleFinish} layout="vertical" size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined style={{ color: '#8b949e' }} />} placeholder="用户名 / 工号"
                style={{ background: '#0d1117', borderColor: '#30363d', color: '#f0f6fc', borderRadius: 6 }}
                variant="borderless" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#8b949e' }} />} placeholder="密码"
                style={{ background: '#0d1117', borderColor: '#30363d', color: '#f0f6fc', borderRadius: 6 }}
                variant="borderless" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block icon={<LoginOutlined />} loading={loading}
              style={{ height: 44, borderRadius: 8, fontSize: 15, marginTop: 4 }}>登 录</Button>
          </Form>
        </Card>
      </div>
    </div>
  )
}
