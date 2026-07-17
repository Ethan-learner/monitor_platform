import { useEffect, useState } from 'react'
import { Card, Descriptions, Tag, Table, Typography, Spin } from 'antd'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useLocation } from 'react-router-dom'

const { Title } = Typography

export default function Profile() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    setLoading(true)
    api.get('/settings/profile').then(r => setProfile(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [location.pathname])

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} />
  if (!profile) return <div style={{ padding: 16 }}>加载失败</div>

  return (
    <div style={{ padding: 16 }}>
      <Title level={5} style={{ marginBottom: 16 }}>个人中心</Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="用户名">{profile.username}</Descriptions.Item>
          <Descriptions.Item label="姓名">{profile.displayName}</Descriptions.Item>
          <Descriptions.Item label="工号">{profile.personCode || '—'}</Descriptions.Item>
          <Descriptions.Item label="部门">{profile.department || '—'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{profile.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="角色">
            <Tag color={profile.role === 'ops' ? 'green' : profile.role === 'dev' ? 'blue' : 'purple'}>
              {profile.role === 'ops' ? '运维' : profile.role === 'dev' ? '开发' : '管理'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="最近登录">{profile.lastLogin || '—'}</Descriptions.Item>
          <Descriptions.Item label="注册时间">{profile.createdAt || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="最近登录记录" size="small">
        <Table
          rowKey="id"
          dataSource={profile.loginLogs || []}
          pagination={false}
          size="small"
          columns={[
            { title: '登录时间', dataIndex: 'loginTime', width: 160, render: (s: string) => s ? new Date(s).toLocaleString() : '—' },
            { title: 'IP', dataIndex: 'ip', width: 120 },
            { title: '浏览器', dataIndex: 'userAgent', ellipsis: true },
            { title: '结果', dataIndex: 'result', width: 80, render: (s: string) => (
              <Tag color={s === 'success' ? 'green' : 'red'}>{s === 'success' ? '成功' : '失败'}</Tag>
            )},
            { title: '失败原因', dataIndex: 'failedReason', ellipsis: true },
          ]}
        />
      </Card>
    </div>
  )
}
