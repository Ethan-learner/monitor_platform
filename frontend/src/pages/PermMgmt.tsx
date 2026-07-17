import { useEffect, useState, useMemo } from 'react'
import { Table, Tag, Input, Space, Button, Typography, message, Tabs, Modal, Checkbox, Card, Row, Col } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title, Text } = Typography

export default function PermMgmt() {
  return (
    <div style={{ padding: 16 }}>
      <Tabs items={[
        { key: 'users', label: '用户权限', children: <UserPermTab /> },
        { key: 'roles', label: '角色权限', children: <RolePermTab /> },
      ]} />
    </div>
  )
}

function PermTree({ perms, permKeys, onChange }: { perms: any[]; permKeys: string[]; onChange: (keys: string[]) => void }) {
  const modules = useMemo(() => [...new Set(perms.map(p => p.module))] as string[], [perms])

  const toggleModule = (mod: string, checked: boolean) => {
    const modKeys = perms.filter(p => p.module === mod).map(p => p.key)
    if (checked) {
      const newKeys = [...new Set([...permKeys, ...modKeys])]
      onChange(newKeys)
    } else {
      onChange(permKeys.filter(k => !modKeys.includes(k)))
    }
  }

  const moduleChecked = (mod: string) => perms.filter(p => p.module === mod).every(p => permKeys.includes(p.key))
  const moduleIndeterminate = (mod: string) => {
    const keys = perms.filter(p => p.module === mod).map(p => p.key)
    const checked = keys.filter(k => permKeys.includes(k))
    return checked.length > 0 && checked.length < keys.length
  }

  return (
    <div style={{ marginTop: 8 }}>
      {modules.map(mod => {
        const subPerms = perms.filter(p => p.module === mod)
        return (
          <div key={mod} style={{ marginBottom: 12 }}>
            <Checkbox
              checked={moduleChecked(mod)}
              indeterminate={moduleIndeterminate(mod)}
              onChange={e => toggleModule(mod, e.target.checked)}
              style={{ fontWeight: 600, marginBottom: 6 }}
            >{mod}</Checkbox>
            <div style={{ paddingLeft: 24 }}>
              <Checkbox.Group value={permKeys} onChange={v => onChange(v as string[])}>
                {subPerms.map(p => (
                  <Checkbox key={p.key} value={p.key} style={{ marginRight: 16, marginBottom: 2 }}>{p.label}</Checkbox>
                ))}
              </Checkbox.Group>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function UserPermTab() {
  const [users, setUsers] = useState<any[]>([])
  const [perms, setPerms] = useState<any[]>([])
  const [editUser, setEditUser] = useState<any>(null)
  const [userPermKeys, setUserPermKeys] = useState<string[]>([])

  useEffect(() => {
    api.get('/settings/users', { params: { limit: 200 } }).then(r => setUsers((r.data?.data || []).filter((u: any) => u.username !== 'admin' && u.status !== -1)))
    api.get('/settings/permissions').then(r => setPerms(r.data || []))
  }, [])

  const openEdit = async (u: any) => {
    setEditUser(u)
  }

  const savePerms = async () => {
    if (!editUser) return
    try { await api.put(`/settings/users/${editUser.id}/permissions`, { permissions: userPermKeys }); message.success('已更新'); setEditUser(null) }
    catch { message.error('操作失败') }
  }

  return (
    <>
      <Table rowKey="id" dataSource={users} size="middle" bordered pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username', width: 100 },
          { title: '姓名', dataIndex: 'displayName', width: 80 },
          { title: '部门', dataIndex: 'department', ellipsis: true },
          { title: '操作', width: 80, render: (_: any, r: any) => <Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button> },
        ]}
      />
      <Modal title="用户权限" open={!!editUser} onCancel={() => setEditUser(null)} onOk={savePerms} okText="保存" width={600}>
        {editUser && <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}><Text>{editUser.displayName || editUser.username}</Text></Card>}
        <PermTree perms={perms} permKeys={userPermKeys} onChange={setUserPermKeys} />
      </Modal>
    </>
  )
}

function RolePermTab() {
  const [roles, setRoles] = useState<any[]>([])
  const [perms, setPerms] = useState<any[]>([])
  const [editRole, setEditRole] = useState<any>(null)
  const [rolePermKeys, setRolePermKeys] = useState<string[]>([])

  useEffect(() => {
    api.get('/settings/roles').then(r => setRoles(r.data || []))
    api.get('/settings/permissions').then(r => setPerms(r.data || []))
  }, [])

  const openEdit = async (role: any) => {
    setEditRole(role)
    setRolePermKeys(role.permissions || [])
  }

  const savePerms = async () => {
    if (!editRole) return
    try { await api.put(`/settings/roles/${editRole.id}/permissions`, { permissions: rolePermKeys }); message.success('已更新'); setEditRole(null); (await api.get('/settings/roles')).data || [] }
    catch { message.error('操作失败') }
  }

  return (
    <>
      <Table rowKey="id" dataSource={roles} size="middle" bordered pagination={false}
        columns={[
          { title: '角色名', dataIndex: 'label', width: 120 },
          { title: '说明', dataIndex: 'description', ellipsis: true },
          { title: '操作', width: 80, render: (_: any, r: any) => <Button size="small" type="text" onClick={() => openEdit(r)}>编辑</Button> },
        ]}
      />
      <Modal title="角色权限" open={!!editRole} onCancel={() => setEditRole(null)} onOk={savePerms} okText="保存" width={600}>
        {editRole && <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}><Text>{editRole.label}</Text></Card>}
        <PermTree perms={perms} permKeys={rolePermKeys} onChange={setRolePermKeys} />
      </Modal>
    </>
  )
}
