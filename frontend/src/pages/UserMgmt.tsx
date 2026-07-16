import { useEffect, useState } from 'react'
import { Table, Tag, Input, Space, Button, Typography, Popconfirm, Select, message } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

export default function UserMgmt() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/settings/users', { params: { limit: 20, offset: (page - 1) * 20, search } })
      setData(data.data || [])
      setTotal(data.total || 0)
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [page])

  const updateRole = async (uid: number, role: string) => {
    try { await api.put(`/settings/users/${uid}/role`, { role }); message.success('角色已更新'); load() }
    catch { message.error('操作失败') }
  }

  const toggleStatus = async (uid: number, current: number) => {
    try { await api.put(`/settings/users/${uid}/status`, { status: current === 1 ? 0 : 1 }); message.success('已更新'); load() }
    catch { message.error('操作失败') }
  }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>用户管理 ({total})</Title>
        <Space>
          <Input placeholder="搜索用户名/姓名/工号" value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => { setPage(1); load() }} style={{ width: 200 }} />
          <Button icon={<SearchOutlined />} onClick={() => { setPage(1); load() }}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>
      <Table
        rowKey="id"
        dataSource={data}
        loading={loading}
        size="middle"
        bordered
        pagination={{ current: page, pageSize: 20, total, showSizeChanger: false, onChange: setPage }}
        columns={[
          { title: '用户名', dataIndex: 'username', width: 120 },
          { title: '姓名', dataIndex: 'displayName', width: 100 },
          { title: '工号', dataIndex: 'personCode', width: 100 },
          { title: '部门', dataIndex: 'department', ellipsis: true },
          { title: '角色', dataIndex: 'role', width: 120, render: (role: string, r: any) => (
            <Select value={role} size="small" style={{ width: 90 }}
              options={[{ label: '运维', value: 'ops' }, { label: '开发', value: 'dev' }, { label: '管理', value: 'mgmt' }]}
              onChange={v => updateRole(r.id, v)} />
          )},
          { title: '状态', dataIndex: 'status', width: 80, render: (s: number) => (
            <Tag color={s === 1 ? 'green' : 'red'}>{s === 1 ? '启用' : '禁用'}</Tag>
          )},
          { title: '最近登录', dataIndex: 'lastLogin', width: 160, render: (s: string) => s ? new Date(s).toLocaleString() : '—' },
          { title: '操作', width: 80, render: (_: any, r: any) => (
            <Popconfirm title={r.status === 1 ? '确认禁用？' : '确认启用？'} onConfirm={() => toggleStatus(r.id, r.status)}>
              <Button size="small" type="text">{r.status === 1 ? '禁用' : '启用'}</Button>
            </Popconfirm>
          )},
        ]}
      />
    </div>
  )
}
