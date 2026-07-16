import { useEffect, useState } from 'react'
import { Table, Tag, Input, Space, Button, Typography, Popconfirm, Select, message, Tabs, Modal, Checkbox, Card } from 'antd'
import { ReloadOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

export default function UserMgmt() {
  const [tab, setTab] = useState('users')

  return (
    <div style={{ padding: 16 }}>
      <Tabs activeKey={tab} onChange={setTab} tabBarExtraContent={<Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>刷新</Button>}
        items={[
          { key: 'users', label: '用户管理', children: <UserTab /> },
          { key: 'roles', label: '角色管理', children: <RoleTab /> },
        ]}
      />
    </div>
  )
}

function UserTab() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editUser, setEditUser] = useState<any>(null)
  const [allRoles, setAllRoles] = useState<any[]>([])
  const [allPerms, setAllPerms] = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<number[]>([])
  const [userPerms, setUserPerms] = useState<string[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/settings/users', { params: { limit: 20, offset: (page - 1) * 20, search } })
      setData(data.data || [])
      setTotal(data.total || 0)
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [page])

  const openEdit = async (user: any) => {
    setEditUser(user)
    try {
      const [rRoles, rPerms] = await Promise.all([
        api.get('/settings/roles'),
        api.get('/settings/permissions'),
        api.get(`/settings/users/${user.id}/roles`),
      ])
      setAllRoles(rRoles.data || [])
      setAllPerms(rPerms.data || [])
      const ur = await api.get(`/settings/users/${user.id}/roles`)
      setUserRoles((ur.data || []).map((r: any) => r.id))
      setUserPerms([])
    } catch {}
  }

  const saveRoles = async () => {
    if (!editUser) return
    try {
      // Remove all existing roles, re-assign
      const existing = await api.get(`/settings/users/${editUser.id}/roles`)
      for (const r of (existing.data || [])) {
        await api.delete(`/settings/users/${editUser.id}/roles/${r.id}`)
      }
      for (const rid of userRoles) {
        await api.post(`/settings/users/${editUser.id}/roles`, { role_id: rid })
      }
      message.success('角色已更新')
      setEditUser(null)
      load()
    } catch { message.error('操作失败') }
  }

  const savePerms = async () => {
    if (!editUser) return
    try {
      await api.put(`/settings/users/${editUser.id}/permissions`, { permissions: userPerms })
      message.success('权限已更新')
    } catch { message.error('操作失败') }
  }

  const toggleStatus = async (uid: number, current: number) => {
    try { await api.put(`/settings/users/${uid}/status`, { status: current === 1 ? 0 : 1 }); message.success('已更新'); load() }
    catch { message.error('操作失败') }
  }

  const permModules = [...new Set(allPerms.map(p => p.module))] as string[]

  return (
    <>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>用户列表 ({total})</Title>
        <Space>
          <Input placeholder="搜索用户名/姓名/工号" value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => { setPage(1); load() }} style={{ width: 200 }} />
          <Button icon={<SearchOutlined />} onClick={() => { setPage(1); load() }}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>
      <Table rowKey="id" dataSource={data} loading={loading} size="middle" bordered
        pagination={{ current: page, pageSize: 20, total, showSizeChanger: false, onChange: setPage }}
        columns={[
          { title: '用户名', dataIndex: 'username', width: 120 },
          { title: '姓名', dataIndex: 'displayName', width: 100 },
          { title: '工号', dataIndex: 'personCode', width: 100 },
          { title: '部门', dataIndex: 'department', ellipsis: true },
          { title: '状态', dataIndex: 'status', width: 70, render: (s: number) => <Tag color={s===1?'green':'red'}>{s===1?'启用':'禁用'}</Tag> },
          { title: '最近登录', dataIndex: 'lastLogin', width: 150, render: (s: string) => s ? new Date(s).toLocaleString() : '—' },
          { title: '操作', width: 140, render: (_: any, r: any) => (
            <Space>
              <Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button>
              <Popconfirm title={r.status===1?'确认禁用？':'确认启用？'} onConfirm={() => toggleStatus(r.id,r.status)}>
                <Button size="small" type="text">{r.status===1?'禁用':'启用'}</Button>
              </Popconfirm>
            </Space>
          )},
        ]}
      />
      <Modal title="编辑用户" open={!!editUser} onCancel={() => setEditUser(null)} footer={null} width={700}>
        <Card size="small" title={`${editUser?.displayName} (${editUser?.username})`} style={{ marginBottom: 16 }}>
          <p>工号: {editUser?.personCode || '—'} | 部门: {editUser?.department || '—'}</p>
        </Card>
        <Tabs items={[
          { key: 'roles', label: '角色分配', children: (
            <>
              <Checkbox.Group value={userRoles} onChange={(v: any) => setUserRoles(v)} style={{ display: 'block', marginBottom: 16 }}>
                {allRoles.filter((r: any) => r.status === 1).map((r: any) => (
                  <Checkbox key={r.id} value={r.id} style={{ marginBottom: 8, display: 'block' }}>
                    <strong>{r.label}</strong> ({r.name}) — {r.description || '无说明'}
                  </Checkbox>
                ))}
              </Checkbox.Group>
              <Button type="primary" onClick={saveRoles}>保存角色</Button>
            </>
          )},
          { key: 'perms', label: '单独权限', children: (
            <>
              {permModules.map(mod => (
                <div key={mod} style={{ marginBottom: 12 }}>
                  <strong style={{ display: 'block', marginBottom: 4, color: '#1677ff' }}>{mod}</strong>
                  <Checkbox.Group value={userPerms} onChange={(v: any) => setUserPerms(v)}>
                    {allPerms.filter(p => p.module === mod).map(p => (
                      <Checkbox key={p.key} value={p.key} style={{ marginRight: 16 }}>{p.label}</Checkbox>
                    ))}
                  </Checkbox.Group>
                </div>
              ))}
              <Button type="primary" onClick={savePerms} style={{ marginTop: 8 }}>保存权限</Button>
            </>
          )},
        ]} />
      </Modal>
    </>
  )
}

function RoleTab() {
  const [roles, setRoles] = useState<any[]>([])
  const [allPerms, setAllPerms] = useState<any[]>([])
  const [editRole, setEditRole] = useState<any>(null)
  const [permKeys, setPermKeys] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [roleUsers, setRoleUsers] = useState<any[]>([])

  const load = async () => {
    try {
      const [r, p, u] = await Promise.all([
        api.get('/settings/roles'),
        api.get('/settings/permissions'),
        api.get('/settings/users', { params: { limit: 200 } }),
      ])
      setRoles(r.data || [])
      setAllPerms(p.data || [])
      setAllUsers(u.data?.data || [])
    } catch {}
  }
  useEffect(() => { load() }, [])

  const openEdit = async (role: any) => {
    setEditRole(role)
    setPermKeys(role.permissions || [])
    try {
      // Get users with this role
      const all = allUsers || (await api.get('/settings/users', { params: { limit: 200 } })).data?.data || []
      setAllUsers(all)
      // Find users that have this role
      const ur: any[] = []
      for (const u of all) {
        try {
          const r = await api.get(`/settings/users/${u.id}/roles`)
          if ((r.data || []).some((x: any) => x.id === role.id)) ur.push(u)
        } catch {}
      }
      setRoleUsers(ur)
    } catch {}
  }

  const saveRolePerms = async () => {
    if (!editRole) return
    try {
      await api.put(`/settings/roles/${editRole.id}/permissions`, { permissions: permKeys })
      message.success('权限已更新')
      load()
    } catch { message.error('操作失败') }
  }

  const permModules = [...new Set(allPerms.map(p => p.module))] as string[]

  return (
    <>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>角色列表</Title>
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
      </Space>
      <Table rowKey="id" dataSource={roles} size="middle" bordered pagination={false}
        columns={[
          { title: '角色名', dataIndex: 'label', width: 120 },
          { title: '标识', dataIndex: 'name', width: 100, render: (s: string) => <code>{s}</code> },
          { title: '说明', dataIndex: 'description', ellipsis: true },
          { title: '权限数', dataIndex: 'permissions', width: 80, align: 'center', render: (p: string[]) => p.length },
          { title: '状态', dataIndex: 'status', width: 70, render: (s: number) => <Tag color={s===1?'green':'red'}>{s===1?'启用':'禁用'}</Tag> },
          { title: '操作', width: 80, render: (_: any, r: any) => (
            <Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button>
          )},
        ]}
      />
      <Modal title="编辑角色" open={!!editRole} onCancel={() => setEditRole(null)} footer={null} width={700}>
        <Card size="small" title={`${editRole?.label} (${editRole?.name})`} style={{ marginBottom: 16 }} />
        <Tabs items={[
          { key: 'perms', label: '权限配置', children: (
            <>
              {permModules.map(mod => (
                <div key={mod} style={{ marginBottom: 12 }}>
                  <strong style={{ display: 'block', marginBottom: 4, color: '#1677ff' }}>{mod}</strong>
                  <Checkbox.Group value={permKeys} onChange={(v: any) => setPermKeys(v)}>
                    {allPerms.filter(p => p.module === mod).map(p => (
                      <Checkbox key={p.key} value={p.key} style={{ marginRight: 16 }}>{p.label}</Checkbox>
                    ))}
                  </Checkbox.Group>
                </div>
              ))}
              <Button type="primary" onClick={saveRolePerms}>保存权限</Button>
            </>
          )},
          { key: 'users', label: `用户 (${roleUsers.length})`, children: (
            <Table rowKey="id" dataSource={roleUsers} size="small" pagination={false}
              columns={[
                { title: '用户名', dataIndex: 'username', width: 120 },
                { title: '姓名', dataIndex: 'displayName', width: 100 },
                { title: '部门', dataIndex: 'department', ellipsis: true },
              ]}
            />
          )},
        ]} />
      </Modal>
    </>
  )
}
