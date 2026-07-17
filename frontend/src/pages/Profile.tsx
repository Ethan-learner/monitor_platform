import { useEffect, useState } from 'react'
import { Card, Descriptions, Tag, Table, Typography, Spin, Button, Modal, Input, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { api } from '../lib/api'
import { useLocation } from 'react-router-dom'

const { Title } = Typography

export default function Profile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const location = useLocation()

  useEffect(() => {
    setLoading(true)
    api.get('/settings/profile').then(r => setProfile(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [location.pathname])

  const openEdit = () => {
    if (!profile) return
    setEditName(profile.displayName || '')
    setEditEmail(profile.email || '')
    setEditPhone(profile.phone || '')
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!profile) return
    try {
      await api.put(`/settings/users/${profile.id}/info`, { displayName: editName, department: profile.department || '', email: editEmail, phone: editPhone })
      message.success('已更新'); setEditOpen(false)
      const r = await api.get('/settings/profile'); setProfile(r.data)
    } catch { message.error('操作失败') }
  }

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} />
  if (!profile) return <div style={{ padding: 16 }}>加载失败</div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>个人中心</Title>
        <Button icon={<EditOutlined />} onClick={openEdit}>编辑资料</Button>
      </div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="用户名">{profile.username}</Descriptions.Item>
          <Descriptions.Item label="姓名">{profile.displayName}</Descriptions.Item>
          <Descriptions.Item label="工号">{profile.personCode || '—'}</Descriptions.Item>
          <Descriptions.Item label="部门">{profile.department || '—'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{profile.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="电话">{profile.phone || '—'}</Descriptions.Item>
          <Descriptions.Item label="最近登录">{profile.lastLogin || '—'}</Descriptions.Item>
          <Descriptions.Item label="注册时间">{profile.createdAt || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="最近登录记录" size="small">
        <Table rowKey="id" dataSource={profile.loginLogs || []} pagination={false} size="small"
          columns={[
            { title: '登录时间', dataIndex: 'loginTime', width: 160, render: (s: string) => s ? new Date(s).toLocaleString() : '—' },
            { title: 'IP', dataIndex: 'ip', width: 120 },
            { title: '浏览器', dataIndex: 'userAgent', ellipsis: true },
            { title: '结果', dataIndex: 'result', width: 80, render: (s: string) => <Tag color={s === 'success' ? 'green' : 'red'}>{s === 'success' ? '成功' : '失败'}</Tag> },
            { title: '失败原因', dataIndex: 'failedReason', ellipsis: true },
          ]}
        />
      </Card>

      <Modal title="编辑资料" open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveEdit} okText="保存" cancelText="取消">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="姓名" value={editName} onChange={e => setEditName(e.target.value)} />
          <Input placeholder="邮箱" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
          <Input addonBefore="+86" placeholder="电话" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
