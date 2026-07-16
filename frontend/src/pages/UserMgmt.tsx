import { useEffect, useState } from 'react'
import { Table, Tag, Input, Space, Button, Typography, Popconfirm, Select, message, Tabs, Modal, Checkbox, Card, Transfer } from 'antd'
import { EditOutlined, StopOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title, Text } = Typography

export default function UserMgmt() {
  const [tab, setTab] = useState('users')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div style={{ padding: 16 }}>
      <Tabs activeKey={tab} onChange={setTab}
        items={[
          { key: 'users', label: '用户管理', children: <UserTab key={refreshKey} /> },
          { key: 'roles', label: '角色管理', children: <RoleTab key={refreshKey} /> },
        ]}
      />
    </div>
  )
}

function UserTab() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<any>(null)
  const [allRoles, setAllRoles] = useState<any[]>([])
  const [allPerms, setAllPerms] = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<number[]>([])
  const [userPerms, setUserPerms] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDisplay, setAddDisplay] = useState('')
  const [addDept, setAddDept] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/settings/users', { params: { limit: 200 } })
      const list = data.data || []
      if (search) {
        const s = search.toLowerCase()
        setData(list.filter((u: any) => (u.username || '').toLowerCase().includes(s) || (u.displayName || '').toLowerCase().includes(s) || (u.personCode || '').includes(s)))
      } else {
        setData(list)
      }
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search])

  const openEdit = async (user: any) => {
    setEditUser(user)
    try {
      const [rRoles, rPerms, rUserRoles] = await Promise.all([
        api.get('/settings/roles'),
        api.get('/settings/permissions'),
        api.get(`/settings/users/${user.id}/roles`),
      ])
      setAllRoles(rRoles.data || [])
      setAllPerms(rPerms.data || [])
      setUserRoles((rUserRoles.data || []).map((r: any) => r.id))
      setUserPerms([])
    } catch {}
  }

  const saveRoles = async () => {
    if (!editUser) return
    try {
      const existing = await api.get(`/settings/users/${editUser.id}/roles`)
      for (const r of (existing.data || [])) await api.delete(`/settings/users/${editUser.id}/roles/${r.id}`)
      for (const rid of userRoles) await api.post(`/settings/users/${editUser.id}/roles`, { role_id: rid })
      message.success('已更新')
      setEditUser(null); load()
    } catch { message.error('操作失败') }
  }

  const savePerms = async () => {
    if (!editUser) return
    try { await api.put(`/settings/users/${editUser.id}/permissions`, { permissions: userPerms }); message.success('已更新') }
    catch { message.error('操作失败') }
  }

  const toggleStatus = async (uid: number, cur: number) => {
    try { await api.put(`/settings/users/${uid}/status`, { status: cur === 1 ? 0 : 1 }); message.success('已更新'); load() }
    catch { message.error('操作失败') }
  }

  const handleAdd = async () => {
    if (!addName) { message.warning('请输入用户名'); return }
    try {
      await api.post('/auth/register', { username: addName, displayName: addDisplay, department: addDept })
      message.success('已创建，默认密码已随机生成')
      setAddOpen(false); setAddName(''); setAddDisplay(''); setAddDept(''); load()
    } catch (e: any) { message.error(e?.response?.data?.detail || '创建失败') }
  }

  const isProtected = (u: any) => u.username === 'admin'
  const permModules = [...new Set(allPerms.map((p: any) => p.module))] as string[]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Input placeholder="搜索用户名/姓名/工号" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} allowClear />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>添加用户</Button>
      </Space>
      <Table rowKey="id" dataSource={data} loading={loading} size="middle" bordered pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username', width: 120,
            render: (s: string, r: any) => (
              <div>
                <strong>{s}</strong>
                <div style={{ fontSize: 11, color: '#999' }}>{r.personCode || ''} {r.department ? `| ${r.department}` : ''}</div>
              </div>
            )
          },
          { title: '姓名', dataIndex: 'displayName', width: 100, render: (s: string) => s || '—' },
          { title: '状态', dataIndex: 'status', width: 70, align: 'center',
            render: (s: number) => <Tag color={s === 1 ? 'green' : 'red'}>{s === 1 ? '启用' : '禁用'}</Tag> },
          { title: '最近登录', dataIndex: 'lastLogin', width: 150, align: 'center',
            render: (s: string) => s ? new Date(s).toLocaleString() : '—' },
          { title: '操作', width: 120, align: 'center', render: (_: any, r: any) => {
            if (isProtected(r)) return <Text type="secondary" style={{ fontSize: 12 }}>系统管理员</Text>
            return (
              <Space>
                <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1677ff' }} />} onClick={() => openEdit(r)} />
                <Popconfirm title={r.status === 1 ? '确认禁用？' : '确认启用？'} onConfirm={() => toggleStatus(r.id, r.status)}>
                  <Button size="small" type="text" icon={<StopOutlined style={{ color: r.status === 1 ? '#fa8c16' : '#999' }} />} />
                </Popconfirm>
              </Space>
            )
          }},
        ]}
      />

      <Modal title="添加用户" open={addOpen} onCancel={() => setAddOpen(false)} onOk={handleAdd} okText="创建">
        <FormFields addName={addName} setAddName={setAddName} addDisplay={addDisplay} setAddDisplay={setAddDisplay} addDept={addDept} setAddDept={setAddDept} />
      </Modal>

      <Modal title="编辑用户" open={!!editUser} onCancel={() => setEditUser(null)} footer={null} width={700}>
        {editUser && (
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
            <Space size={24}>
              <span><Text type="secondary">用户名</Text> <strong>{editUser.username}</strong></span>
              <span><Text type="secondary">姓名</Text> <strong>{editUser.displayName || '—'}</strong></span>
              <span><Text type="secondary">工号</Text> <strong>{editUser.personCode || '—'}</strong></span>
              <span><Text type="secondary">部门</Text> <strong>{editUser.department || '—'}</strong></span>
            </Space>
          </Card>
        )}
        <Tabs items={[
          { key: 'roles', label: '角色分配', children: (
            <div style={{ padding: '8px 0' }}>
              <Checkbox.Group value={userRoles} onChange={(v: any) => setUserRoles(v)} style={{ display: 'block', marginBottom: 16 }}>
                {allRoles.filter((r: any) => r.status === 1).map((r: any) => (
                  <Checkbox key={r.id} value={r.id} style={{ marginBottom: 8, display: 'block' }}>
                    <strong>{r.label}</strong> <Text type="secondary">({r.name})</Text>
                  </Checkbox>
                ))}
              </Checkbox.Group>
              <Button type="primary" onClick={saveRoles}>保存角色</Button>
            </div>
          )},
          { key: 'perms', label: '单独权限', children: (
            <div style={{ padding: '8px 0' }}>
              {permModules.map(mod => (
                <div key={mod} style={{ marginBottom: 16 }}>
                  <strong style={{ display: 'block', marginBottom: 6, color: '#1677ff' }}>{mod}</strong>
                  <Checkbox.Group value={userPerms} onChange={(v: any) => setUserPerms(v)}>
                    {allPerms.filter((p: any) => p.module === mod).map((p: any) => (
                      <Checkbox key={p.key} value={p.key} style={{ marginRight: 20, marginBottom: 4 }}>{p.label}</Checkbox>
                    ))}
                  </Checkbox.Group>
                </div>
              ))}
              <Button type="primary" onClick={savePerms}>保存权限</Button>
            </div>
          )},
        ]} />
      </Modal>
    </>
  )
}

function FormFields({ addName, setAddName, addDisplay, setAddDisplay, addDept, setAddDept }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Input placeholder="用户名 (英文)" value={addName} onChange={e => setAddName(e.target.value)} />
      <Input placeholder="姓名" value={addDisplay} onChange={e => setAddDisplay(e.target.value)} />
      <Input placeholder="部门" value={addDept} onChange={e => setAddDept(e.target.value)} />
    </div>
  )
}

function RoleTab() {
  const [roles, setRoles] = useState<any[]>([])
  const [allPerms, setAllPerms] = useState<any[]>([])
  const [editRole, setEditRole] = useState<any>(null)
  const [permKeys, setPermKeys] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferRole, setTransferRole] = useState<any>(null)
  const [transferKeys, setTransferKeys] = useState<number[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addName, setAddName] = useState('')

  const load = async () => {
    try {
      const [r, p] = await Promise.all([api.get('/settings/roles'), api.get('/settings/permissions')])
      setRoles(r.data || [])
      setAllPerms(p.data || [])
    } catch {}
  }
  useEffect(() => { load() }, [])

  const openEdit = (role: any) => { setEditRole(role); setPermKeys(role.permissions || []) }

  const saveRolePerms = async () => {
    if (!editRole) return
    try { await api.put(`/settings/roles/${editRole.id}/permissions`, { permissions: permKeys }); message.success('已更新'); load() }
    catch { message.error('操作失败') }
  }

  const openTransfer = async (role: any) => {
    setTransferRole(role)
    setTransferKeys([])
    try {
      const { data: users } = await api.get('/settings/users', { params: { limit: 200 } })
      const list = users.data || []
      setAllUsers(list)
      // Find which users already have this role
      const assigned: number[] = []
      for (const u of list) {
        try {
          const r = await api.get(`/settings/users/${u.id}/roles`)
          if ((r.data || []).some((x: any) => x.id === role.id)) assigned.push(u.id)
        } catch {}
      }
      setTransferKeys(assigned)
    } catch {}
    setTransferOpen(true)
  }

  const saveTransfer = async () => {
    if (!transferRole) return
    try {
      // Get current users
      const current: number[] = []
      for (const u of allUsers) {
        try {
          const r = await api.get(`/settings/users/${u.id}/roles`)
          if ((r.data || []).some((x: any) => x.id === transferRole.id)) current.push(u.id)
        } catch {}
      }
      // Add new
      for (const uid of transferKeys) {
        if (!current.includes(uid)) await api.post(`/settings/users/${uid}/roles`, { role_id: transferRole.id })
      }
      // Remove unselected
      for (const uid of current) {
        if (!transferKeys.includes(uid)) await api.delete(`/settings/users/${uid}/roles/${transferRole.id}`)
      }
      message.success('已更新')
      setTransferOpen(false)
    } catch { message.error('操作失败') }
  }

  const handleAddRole = async () => {
    if (!addName || !addLabel) { message.warning('请填写完整'); return }
    try { await api.post('/settings/roles', { name: addName, label: addLabel }); message.success('已创建'); setAddOpen(false); setAddName(''); setAddLabel(''); load() }
    catch (e: any) { message.error(e?.response?.data?.detail || '创建失败') }
  }

  const toggleRoleStatus = async (rid: number, cur: number) => {
    try { await api.put(`/settings/roles/${rid}`, { status: cur === 1 ? 0 : 1 }); message.success('已更新'); load() }
    catch { message.error('操作失败') }
  }

  const deleteRole = async (rid: number) => {
    try { await api.delete(`/settings/roles/${rid}`); message.success('已删除'); load() }
    catch { message.error('操作失败') }
  }

  const permModules = [...new Set(allPerms.map((p: any) => p.module))] as string[]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>添加角色</Button>
      </Space>
      <Table rowKey="id" dataSource={roles} size="middle" bordered pagination={false}
        columns={[
          { title: '角色名', dataIndex: 'label', width: 120 },
          { title: '标识', dataIndex: 'name', width: 100, render: (s: string) => <code>{s}</code> },
          { title: '权限数', dataIndex: 'permissions', width: 80, align: 'center', render: (p: string[]) => p.length },
          { title: '状态', dataIndex: 'status', width: 70, align: 'center',
            render: (s: number) => <Tag color={s === 1 ? 'green' : 'red'}>{s === 1 ? '启用' : '禁用'}</Tag> },
          { title: '操作', width: 160, align: 'center', render: (_: any, r: any) => (
            <Space>
              <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1677ff' }} />} onClick={() => openEdit(r)} />
              <Button size="small" type="text" icon={<PlusOutlined style={{ color: '#52c41a' }} />} onClick={() => openTransfer(r)} title="分配用户" />
              <Popconfirm title="确认禁用？" onConfirm={() => toggleRoleStatus(r.id, r.status)} disabled={r.status === 0}>
                <Button size="small" type="text" icon={<StopOutlined style={{ color: r.status === 1 ? '#fa8c16' : '#999' }} />} />
              </Popconfirm>
              <Popconfirm title="确认删除？" onConfirm={() => deleteRole(r.id)}>
                <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
              </Popconfirm>
            </Space>
          )},
        ]}
      />

      <Modal title="添加角色" open={addOpen} onCancel={() => setAddOpen(false)} onOk={handleAddRole} okText="创建">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="标识 (英文)" value={addName} onChange={e => setAddName(e.target.value)} />
          <Input placeholder="显示名" value={addLabel} onChange={e => setAddLabel(e.target.value)} />
        </div>
      </Modal>

      <Modal title="编辑角色" open={!!editRole} onCancel={() => setEditRole(null)} footer={null} width={700}>
        {editRole && (
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
            <strong>{editRole.label}</strong> <Text type="secondary">({editRole.name})</Text>
          </Card>
        )}
        <div style={{ padding: '8px 0' }}>
          {permModules.map(mod => (
            <div key={mod} style={{ marginBottom: 16 }}>
              <strong style={{ display: 'block', marginBottom: 6, color: '#1677ff' }}>{mod}</strong>
              <Checkbox.Group value={permKeys} onChange={(v: any) => setPermKeys(v)}>
                {allPerms.filter((p: any) => p.module === mod).map((p: any) => (
                  <Checkbox key={p.key} value={p.key} style={{ marginRight: 20, marginBottom: 4 }}>{p.label}</Checkbox>
                ))}
              </Checkbox.Group>
            </div>
          ))}
          <Button type="primary" onClick={saveRolePerms}>保存权限</Button>
        </div>
      </Modal>

      <Modal title="分配用户" open={transferOpen} onCancel={() => setTransferOpen(false)} onOk={saveTransfer} okText="保存" width={600}>
        {transferRole && <p style={{ marginBottom: 12 }}>角色: <strong>{transferRole.label}</strong></p>}
        <Transfer
          dataSource={allUsers.map((u: any) => ({ key: u.id, title: `${u.displayName || u.username} (${u.department || '-'})` }))}
          targetKeys={transferKeys}
          onChange={keys => setTransferKeys(keys as number[])}
          render={item => item.title}
          listStyle={{ width: 250, height: 400 }}
          showSearch
        />
      </Modal>
    </>
  )
}
