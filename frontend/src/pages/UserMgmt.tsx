import { useEffect, useState } from 'react'
import { Table, Tag, Input, Space, Button, Typography, Popconfirm, message, Tabs, Modal, Card, Row, Col, Select } from 'antd'
import { EditOutlined, StopOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Text } = Typography

const lineStyle: React.CSSProperties = { border: 'none', borderBottom: '1px solid #d9d9d9', borderRadius: 0, padding: '4px 0', boxShadow: 'none', outline: 'none', background: 'transparent' }
const labelS: React.CSSProperties = { color: '#333', minWidth: 75, fontSize: 13, lineHeight: '32px' }
const rowS: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }
const LInput = (p: any) => <Input {...p} style={{ ...lineStyle, flex: 1 }} variant="borderless" autoComplete="off" />
const LPassword = (p: any) => <Input.Password {...p} style={{ ...lineStyle, flex: 1 }} variant="borderless" autoComplete="new-password" />
const LSelect = (p: any) => <Select {...p} variant="borderless" style={{ width: '100%', border: 'none', borderBottom: '1px solid #d9d9d9', borderRadius: 0, padding: '4px 0', boxShadow: 'none', outline: 'none', background: 'transparent' }} />
const LRow = (p: any) => <div style={{ ...rowS, ...(p.style || {}) }}><span style={labelS}>{p.label}:</span>{p.children}</div>

function AddUserModal({ open, onClose, onSuccess, allRoles }: { open: boolean; onClose: () => void; onSuccess: () => void; allRoles: any[] }) {
  const [name, setName] = useState('')
  const [display, setDisplay] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [roleIds, setRoleIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleAdd = async () => {
    if (!name) { message.warning('请输入用户名'); return }
    setSubmitting(true)
    try {
      const res = await api.post('/auth/register', { username: name, displayName: display, email, phone, password: password || undefined })
      const newUid = res.data.id
      if (newUid && roleIds.length > 0) {
        for (const rid of roleIds) await api.post(`/settings/users/${newUid}/roles`, { role_id: rid })
      }
      message.success(password ? '已创建' : `已创建，初始密码: ${res.data.password}`)
      onClose(); onSuccess()
    } catch (e: any) { message.error(e?.response?.data?.detail || '创建失败') }; setSubmitting(false)
  }

  return (
    <Modal title="新增用户" open={open} onCancel={onClose} onOk={handleAdd} okText="确定" cancelText="取消" width={520} confirmLoading={submitting}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '16px 8px' }}>
        <LRow label="用户名"><LInput placeholder="请输入" value={name} onChange={(e: any) => setName(e.target.value)} /></LRow>
        <LRow label="姓名"><LInput placeholder="请输入" value={display} onChange={(e: any) => setDisplay(e.target.value)} /></LRow>
        <LRow label="密码">
          <LPassword placeholder="留空自动生成" value={password} onChange={(e: any) => setPassword(e.target.value)} />
          <Button size="small" onClick={() => setPassword(genPwd())}>生成</Button>
        </LRow>
        <LRow label="手机"><LInput addonBefore="+86" placeholder="非必填" value={phone} onChange={(e: any) => setPhone(e.target.value)} /></LRow>
        <LRow label="邮箱"><LInput placeholder="非必填" value={email} onChange={(e: any) => setEmail(e.target.value)} /></LRow>
        <LRow label="角色"><LSelect mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="请选择" value={roleIds} onChange={(v: any) => setRoleIds(v)} options={allRoles.filter(r => r.status === 1).map(r => ({ value: r.id, label: r.label }))} /></LRow>
      </div>
    </Modal>
  )
}

function genPwd() { const a=new Uint8Array(9); crypto.getRandomValues(a); return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('') }

function EditUserModal({ user, allRoles, onClose, onSuccess }: { user: any; allRoles: any[]; onClose: () => void; onSuccess: () => void }) {
  const [displayName, setDisplayName] = useState(user.displayName || '')
  const [department, setDepartment] = useState(user.department || '')
  const [email, setEmail] = useState(user.email || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [password, setPassword] = useState('')
  const [roleIds, setRoleIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await api.get(`/settings/users/${user.id}/roles`)
        if (!cancelled) {
          setRoleIds((r.data || []).map((x: any) => x.id))
          setLoaded(true)
        }
      } catch {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [user.id])

  const handleSave = async () => {
    setSubmitting(true)
    try {
      await api.put(`/settings/users/${user.id}/info`, {
        displayName, department, email, phone,
        password: password || undefined,
      })
      const existing = await api.get(`/settings/users/${user.id}/roles`)
      for (const r of (existing.data || [])) await api.delete(`/settings/users/${user.id}/roles/${r.id}`)
      for (const rid of roleIds) await api.post(`/settings/users/${user.id}/roles`, { role_id: rid })
      message.success('已更新'); onSuccess(); onClose()
    } catch { message.error('操作失败') }
    finally { setSubmitting(false) }
  }

  return (
    <Modal title={`编辑用户：${user.username}`} open onCancel={onClose} onOk={handleSave} okText="保存" cancelText="取消" width={520} confirmLoading={submitting}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '16px 8px' }}>
        <LRow label="用户名"><Input value={user.username} disabled style={{ ...lineStyle, flex: 1, color: '#999' }} variant="borderless" /></LRow>
        <LRow label="姓名"><LInput placeholder="请输入" value={displayName} onChange={(e: any) => setDisplayName(e.target.value)} /></LRow>
        <LRow label="部门"><LInput placeholder="请输入" value={department} onChange={(e: any) => setDepartment(e.target.value)} /></LRow>
        <LRow label="密码">
          <LPassword placeholder="留空则不修改" value={password} onChange={(e: any) => setPassword(e.target.value)} />
          <Button size="small" onClick={() => setPassword(genPwd())}>生成</Button>
        </LRow>
        <LRow label="手机"><LInput addonBefore="+86" placeholder="非必填" value={phone} onChange={(e: any) => setPhone(e.target.value)} /></LRow>
        <LRow label="邮箱"><LInput placeholder="非必填" value={email} onChange={(e: any) => setEmail(e.target.value)} /></LRow>
        <LRow label="角色">
          <LSelect
            mode="multiple" allowClear showSearch optionFilterProp="label" placeholder={loaded ? '请选择' : '加载中...'}
            value={roleIds} onChange={setRoleIds}
            options={allRoles.filter(r => r.status === 1).map(r => ({ value: r.id, label: r.label }))}
          />
        </LRow>
      </div>
    </Modal>
  )
}

export default function UserMgmt() {
  const [tab, setTab] = useState('users')

  return (
    <div style={{ padding: 16 }}>
      <Tabs activeKey={tab} onChange={setTab}
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
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<any>(null)
  const [editPassword, setEditPassword] = useState('')
  const [allRoles, setAllRoles] = useState<any[]>([])
  const [allPerms, setAllPerms] = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<number[]>([])
  const [userPerms, setUserPerms] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/settings/users', { params: { limit: 200 } })
      const list = (data.data || []).filter((u: any) => u.status !== -1)
      if (search) {
        const s = search.toLowerCase()
        setData(list.filter((u: any) => (u.username || '').toLowerCase().includes(s) || (u.displayName || '').toLowerCase().includes(s) || (u.personCode || '').includes(s)))
      } else { setData(list) }
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search])

  const openEdit = async (user: any) => {
    setEditUser(user)
    try {
      const [rRoles, rPerms, rUserRoles] = await Promise.all([
        api.get('/settings/roles'), api.get('/settings/permissions'), api.get(`/settings/users/${user.id}/roles`),
      ])
      setAllRoles(rRoles.data || [])
      setAllPerms(rPerms.data || [])
      setUserRoles((rUserRoles.data || []).map((r: any) => r.id))
      setUserPerms([])
    } catch {}
  }

  const toggleStatus = async (uid: number, cur: number) => {
    try { await api.put(`/settings/users/${uid}/status`, { status: cur === 1 ? 0 : 1 }); message.success('已更新'); load() }
    catch { message.error('操作失败') }
  }

  const isProtected = (u: any) => u.username === 'admin'

  return (
    <>
      <style>{`input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 1000px transparent inset!important;box-shadow:0 0 0 1000px transparent inset!important;-webkit-text-fill-color:inherit!important;caret-color:inherit!important}.ant-select-selector{box-shadow:none!important;outline:none!important;padding-left:0!important}.ant-select-selection-placeholder{padding-left:0!important}.ant-select-focused .ant-select-selector{box-shadow:none!important;outline:none!important;border-color:transparent!important}.ant-select-open .ant-select-selector{box-shadow:none!important;outline:none!important}.ant-picker{box-shadow:none!important}.ant-input-affix-wrapper:focus,.ant-input-affix-wrapper-focused{box-shadow:none!important;outline:none!important}`}</style>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'flex-end' }}>
        <Input placeholder="搜索" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 160 }} allowClear prefix={<SearchOutlined />} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>新增用户</Button>
      </Space>
      <Table rowKey="id" dataSource={data} loading={loading} size="middle" bordered pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username', align: 'center', width: 100 },
          { title: '工号', dataIndex: 'personCode', align: 'center', width: 100, render: (s: string) => s || '—' },
          { title: '姓名', dataIndex: 'displayName', align: 'center', width: 80, render: (s: string) => s || '—' },
          { title: '部门', dataIndex: 'department', align: 'center', width: 120, ellipsis: true, render: (s: string) => s || '—' },
          { title: '角色', width: 100, align: 'center', render: (_: any, r: any) => {
            const labels = allRoles.filter((x: any) => r.roles?.includes(x.id)).map((x: any) => x.label)
            return labels.length > 0 ? labels.join(',') : <Text type="secondary">未分配</Text>
          }},
          { title: '邮箱', dataIndex: 'email', align: 'center', width: 140, ellipsis: true, render: (s: string) => s || '—' },
          { title: '手机', dataIndex: 'phone', align: 'center', width: 100, render: (s: string) => s || '—' },
          { title: '状态', dataIndex: 'status', width: 70, align: 'center', render: (s: number) => <Tag color={s === 1 ? 'green' : 'orange'}>{s === 1 ? '启用' : '禁用'}</Tag> },
          { title: '操作', width: 130, align: 'center', render: (_: any, r: any) => {
            if (isProtected(r)) return <Text type="secondary" style={{ fontSize: 12 }}>受保护</Text>
            return (
              <Space>
                <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1677ff' }} />} onClick={() => openEdit(r)} />
                <Popconfirm title={r.status === 1 ? '确认禁用？' : '确认启用？'} onConfirm={() => toggleStatus(r.id, r.status)}>
                  <Button size="small" type="text" icon={<StopOutlined style={{ color: r.status === 1 ? '#fa8c16' : '#999' }} />} />
                </Popconfirm>
                <Popconfirm title="确认删除该用户？" onConfirm={() => { api.delete(`/settings/users/${r.id}`).then(load).catch(() => message.error('操作失败')) }}>
                  <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
                </Popconfirm>
              </Space>
            )
          }},
        ]}
      />

      {addOpen && <AddUserModal key={Date.now()} open={addOpen} onClose={() => setAddOpen(false)} onSuccess={load} allRoles={allRoles} />}
      {editUser && <EditUserModal key={editUser.id} user={editUser} allRoles={allRoles} onClose={() => setEditUser(null)} onSuccess={load} />}
    </>
  )
}

function RoleTab() {
  const [roles, setRoles] = useState<any[]>([])
  const [allPerms, setAllPerms] = useState<any[]>([])
  const [editRole, setEditRole] = useState<any>(null)
  const [permKeys, setPermKeys] = useState<string[]>([])
  const [editRoleLabel, setEditRoleLabel] = useState('')
  const [editRoleDesc, setEditRoleDesc] = useState('')
  const [selectedRole, setSelectedRole] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [assignedUsers, setAssignedUsers] = useState<any[]>([])
  const [unassignedUsers, setUnassignedUsers] = useState<any[]>([])
  const [roleSearch, setRoleSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addRoleDesc, setAddRoleDesc] = useState('')

  const load = async () => {
    try {
      const [r, p, u] = await Promise.all([
        api.get('/settings/roles'), api.get('/settings/permissions'), api.get('/settings/users', { params: { limit: 200 } }),
      ])
      setRoles(r.data || [])
      setAllPerms(p.data || [])
      setAllUsers((u.data?.data || []).filter((x: any) => x.username !== 'admin' && x.status !== -1))
    } catch {}
  }
  useEffect(() => { load() }, [])

  const [editMode, setEditMode] = useState(false)

  const selectRole = async (role: any) => {
    setSelectedRole(role); setEditMode(false)
    const a: any[] = []; const ua: any[] = []
    for (const u of allUsers) {
      try {
        const r = await api.get(`/settings/users/${u.id}/roles`)
        if ((r.data || []).some((x: any) => x.id === role.id)) a.push(u); else ua.push(u)
      } catch { ua.push(u) }
    }
    setAssignedUsers(a); setUnassignedUsers(ua)
  }

  const assignUser = async (uid: number) => {
    if (!selectedRole) return
    const u = unassignedUsers.find(x => x.id === uid)
    if (!u) return
    try {
      await api.post(`/settings/users/${uid}/roles`, { role_id: selectedRole.id })
      setAssignedUsers(prev => [...prev, u])
      setUnassignedUsers(prev => prev.filter(x => x.id !== uid))
    } catch { message.error('操作失败') }
  }

  const removeUser = async (uid: number) => {
    if (!selectedRole) return
    const u = assignedUsers.find(x => x.id === uid)
    if (!u) return
    try {
      await api.delete(`/settings/users/${uid}/roles/${selectedRole.id}`)
      setUnassignedUsers(prev => [...prev, u])
      setAssignedUsers(prev => prev.filter(x => x.id !== uid))
    } catch { message.error('操作失败') }
  }

  const openEditRole = (role: any) => {
    if (!addLabel) { message.warning('请输入角色名称'); return }
    const name = addLabel.replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fff]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    try {
      await api.post('/settings/roles', { name, label: addLabel, description: addRoleDesc })
      message.success('已创建'); setAddOpen(false); setAddLabel(''); setAddRoleDesc(''); load()
    } catch (e: any) { message.error(e?.response?.data?.detail || '创建失败') }
  }

  const openEditRole = (role: any) => {
    setEditRole(role); setPermKeys(role.permissions || []); setEditRoleLabel(role.label || ''); setEditRoleDesc(role.description || '')
  }

  const saveRoleMeta = async () => {
    if (!editRole) return
    try { await api.put(`/settings/roles/${editRole.id}`, { label: editRoleLabel, description: editRoleDesc }); message.success('已更新'); load() }
    catch { message.error('操作失败') }
  }

  const deleteRole = async (rid: number) => {
    try { await api.delete(`/settings/roles/${rid}`); message.success('已删除'); load(); setSelectedRole(null) }
    catch { message.error('操作失败') }
  }

  const filteredRoles = roles.filter(r => !roleSearch || r.label.includes(roleSearch) || r.name.includes(roleSearch))

  return (
    <Row gutter={16} style={{ height: 'calc(100vh - 160px)' }}>
      <Col span={8}>
        <Card size="small" style={{ height: '100%' }} bodyStyle={{ height: 'calc(100% - 38px)', display: 'flex', flexDirection: 'column', padding: '12px 12px 0' }}
          title={<Space style={{ width: '100%', justifyContent: 'space-between' }}><span>角色列表</span><Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setAddOpen(true)} /></Space>}>
          <Input size="small" placeholder="搜索角色" prefix={<SearchOutlined />} value={roleSearch} onChange={e => setRoleSearch(e.target.value)}
            style={{ marginBottom: 12 }} variant="borderless" />
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filteredRoles.map(r => (
              <div key={r.id} onClick={() => selectRole(r)}
                style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 6, marginBottom: 4, background: selectedRole?.id === r.id ? '#e6f4ff' : '#fff', border: selectedRole?.id === r.id ? '1px solid #1677ff' : '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><strong>{r.label}</strong><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.description || r.name}</Text></div>
                <Space>
                  <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} onClick={e => { e.stopPropagation(); openEditRole(r) }} />
                  <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} onClick={e => { e.stopPropagation(); deleteRole(r.id) }} />
                </Space>
              </div>
            ))}
          </div>
        </Card>
      </Col>
      <Col span={16}>
        <Card size="small" style={{ height: '100%' }} bodyStyle={{ height: 'calc(100% - 38px)', display: 'flex', flexDirection: 'column', padding: 12 }}
          title={<Space><span>用户列表</span>{selectedRole && <Text type="secondary">({selectedRole.label})</Text>}</Space>}
          extra={selectedRole ? <Button size="small" type={editMode ? 'primary' : 'default'} onClick={() => setEditMode(!editMode)}>{editMode ? '完成编辑' : '编辑用户'}</Button> : null}>
          {selectedRole ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ flex: 1, border: '1px solid #e8e8e8', borderRadius: '8px 8px 0 0', padding: 12, overflow: 'auto', minHeight: 0 }}>
                <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 600, marginBottom: 8 }}>已分配用户 ({assignedUsers.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {assignedUsers.map(u => {
                    const label = `${u.displayName || u.username}（${u.personCode || '-'}）`
                    return editMode ? (
                      <Tag key={u.id} closable onClose={() => removeUser(u.id)} style={{ margin: 0, cursor: 'pointer' }}>{label}</Tag>
                    ) : (
                      <Tag key={u.id} style={{ margin: 0 }}>{label}</Tag>
                    )
                  })}
                </div>
              </div>
              <div style={{ flex: 1, border: '1px solid #e8e8e8', borderRadius: '0 0 8px 8px', borderTop: 'none', padding: 12, overflow: 'auto', minHeight: 0 }}>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 8 }}>未分配用户 ({unassignedUsers.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {unassignedUsers.map(u => {
                    const label = `${u.displayName || u.username}（${u.personCode || '-'}）`
                    return editMode ? (
                      <Tag key={u.id} style={{ margin: 0, cursor: 'pointer', borderStyle: 'dashed' }} onClick={() => assignUser(u.id)}>{label}</Tag>
                    ) : (
                      <Tag key={u.id} style={{ margin: 0, color: '#ccc' }}>{label}</Tag>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#999', padding: 40, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>请选择角色</div>
          )}
        </Card>
      </Col>

      <Modal title="新增角色" open={addOpen} onCancel={() => setAddOpen(false)} onOk={handleAddRole} okText="创建">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="角色名称" value={addLabel} onChange={e => setAddLabel(e.target.value)} />
          <Input placeholder="角色备注" value={addRoleDesc} onChange={e => setAddRoleDesc(e.target.value)} />
        </div>
      </Modal>

      <Modal title="编辑角色" open={!!editRole} onCancel={() => setEditRole(null)} onOk={async () => { await saveRoleMeta(); setEditRole(null); load(); }} okText="保存" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="角色名称" value={editRoleLabel} onChange={e => setEditRoleLabel(e.target.value)} />
          <Input placeholder="角色备注" value={editRoleDesc} onChange={e => setEditRoleDesc(e.target.value)} />
        </div>
      </Modal>
    </Row>
  )
}
