import { Card, Typography, Button, Form, Input, message } from 'antd'
import { LoginOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

const { Title, Text } = Typography

export default function Login() {
  const { isAuthenticated, init } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const isDev = !!(import.meta as any).env?.DEV

  const handleFinish = async (values: { username: string; password: string }) => {
    try {
      const { data } = await api.post('/auth/login', values)
      await init()
      message.success(`欢迎回来，${data.displayName}`)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '登录失败')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <Card style={{ width: 400, textAlign: 'center', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <Title level={3} style={{ marginBottom: 4 }}>统一监控门户</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>Unified Monitoring Portal</Text>
        <Form onFinish={handleFinish} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名 / 工号" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<LoginOutlined />}>登 录</Button>
          </Form.Item>
        </Form>
        {isDev && (
          <div style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
            <p>开发模式：admin / admin123 | dev / dev123 | manager / mgr123</p>
          </div>
        )}
      </Card>
    </div>
  )
}
