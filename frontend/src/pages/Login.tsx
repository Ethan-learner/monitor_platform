import { Card, Typography, Button, Form, Input, message } from 'antd'
import { LoginOutlined, UserOutlined, LockOutlined } from '@ant-design/icons'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const { Title, Text } = Typography

const VALID_USERS: Record<string, string> = { admin: 'admin123', dev: 'dev123', manager: 'mgr123' }

export default function Login() {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleFinish = (values: { username: string; password: string }) => {
    if (VALID_USERS[values.username] === values.password) {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = '/api/auth/dev-login'
      const u = document.createElement('input'); u.name = 'username'; u.value = values.username
      const p = document.createElement('input'); p.name = 'password'; p.value = values.password
      form.appendChild(u); form.appendChild(p)
      document.body.appendChild(form)
      form.submit()
      document.body.removeChild(form)
    } else {
      message.error('用户名或密码错误')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <Card style={{ width: 400, borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0 }}>统一监控门户</Title>
          <Text type="secondary">Unified Monitoring Portal</Text>
        </div>
        <Form onFinish={handleFinish} layout="vertical" size="large">
          <Form.Item name="username" initialValue="admin" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<LoginOutlined />}>
              登 录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
          <p style={{ margin: '2px 0' }}>测试账号：admin / admin123 (运维)</p>
          <p style={{ margin: '2px 0' }}>dev / dev123 (开发)</p>
          <p style={{ margin: '2px 0' }}>manager / mgr123 (管理)</p>
        </div>
      </Card>
    </div>
  )
}
