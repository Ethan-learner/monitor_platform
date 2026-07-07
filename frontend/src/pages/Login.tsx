import { Form, Input, Button, Card, Typography, message, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

const mockUsers = [
  { username: 'admin', password: 'admin123', role: 'ops' as const, displayName: '运维管理员' },
  { username: 'dev', password: 'dev123', role: 'dev' as const, displayName: '开发工程师' },
  { username: 'manager', password: 'mgr123', role: 'mgmt' as const, displayName: '管理者' },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = (values: { username: string; password: string }) => {
    const user = mockUsers.find(
      (u) => u.username === values.username && u.password === values.password,
    );
    if (user) {
      login({ username: user.username, displayName: user.displayName, role: user.role });
      message.success(`欢迎回来，${user.displayName}`);
      navigate('/dashboard', { replace: true });
    } else {
      message.error('用户名或密码错误');
    }
  };

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
        <Form onFinish={handleSubmit} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              登 录
            </Button>
          </Form.Item>
        </Form>
        <Divider />
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            对接公司域控 LDAP/OAuth 后实现单点登录
          </Text>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: '#999' }}>
          <p style={{ margin: '4px 0' }}>测试账号：</p>
          <p style={{ margin: '2px 0' }}>admin / admin123 (运维)</p>
          <p style={{ margin: '2px 0' }}>dev / dev123 (开发)</p>
          <p style={{ margin: '2px 0' }}>manager / mgr123 (管理)</p>
        </div>
      </Card>
    </div>
  );
}
