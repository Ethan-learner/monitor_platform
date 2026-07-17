import { useEffect, useState, useMemo } from 'react'
import { Table, Tag, Input, Space, Button, Typography, message, Tabs, Modal, Checkbox, Card, Row, Col } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { api } from '../lib/api'
import { roleMenus, type MenuItem } from '../config/menus'

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

function collectKeys(items: MenuItem[]): string[] {
  const keys: string[] = []
  for (const item of items) {
    keys.push(item.key)
    if (item.children) keys.push(...collectKeys(item.children))
  }
  return keys
}

function MenuCheckbox({ items, checked, onChange }: { items: MenuItem[]; checked: string[]; onChange: (keys: string[]) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const allKeys = useMemo(() => collectKeys(items), [items])

  const allChecked = allKeys.every(k => checked.includes(k))
  const indeterminate = allKeys.some(k => checked.includes(k)) && !allChecked

  const toggleAll = (v: boolean) => {
    if (v) { onChange([...new Set([...checked, ...allKeys])]) }
    else { onChange(checked.filter(k => !allKeys.includes(k))) }
  }

  const allItemsChecked = (its: MenuItem[]): boolean => its.every(i => {
    if (i.children) return allItemsChecked(i.children)
    return checked.includes(i.key)
  })
  const someItemsChecked = (its: MenuItem[]): boolean => its.some(i => {
    if (i.children) return someItemsChecked(i.children)
    return checked.includes(i.key)
  })

  return (
    <div>
      {items.map(item => {
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expanded[item.key] ?? false

        if (item.key === 'overview') return null

        const toggleExpand = () => setExpanded({ ...expanded, [item.key]: !isExpanded })

        return (
          <div key={item.key} style={{ marginBottom: hasChildren ? 12 : 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {hasChildren && (
                <span onClick={toggleExpand} style={{ cursor: 'pointer', fontSize: 11, color: '#999', userSelect: 'none', width: 16, textAlign: 'center' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              )}
              {!hasChildren && <span style={{ width: 16 }} />}
              <Checkbox checked={allItemsChecked(item.children || [item] as MenuItem[])} indeterminate={hasChildren && someItemsChecked(item.children!) && !allItemsChecked(item.children!)}
                onChange={e => {
                  const keys = hasChildren ? collectKeys(item.children!) : [item.key]
                  if (e.target.checked) { onChange([...new Set([...checked, ...keys])]) }
                  else { onChange(checked.filter(k => !keys.includes(k))) }
                }}
                style={{ fontWeight: hasChildren ? 600 : 400 }}>{item.label}</Checkbox>
            </div>
            {hasChildren && isExpanded && (
              <div style={{ paddingLeft: 24, marginTop: 4 }}>
                {item.children!.map(child => {
                  const grandChildren = child.children && child.children.length > 0
                  const childChecked = grandChildren ? allItemsChecked(child.children!) : checked.includes(child.key)
                  const childIndeterminate = grandChildren && someItemsChecked(child.children!) && !allItemsChecked(child.children!)

                  if (!grandChildren) {
                    return (
                      <div key={child.key} style={{ marginBottom: 2 }}>
                        <Checkbox checked={childChecked} onChange={e => {
                          if (e.target.checked) { onChange([...checked, child.key]) }
                          else { onChange(checked.filter(k => k !== child.key)) }
                        }} style={{ fontSize: 13 }}>{child.label}</Checkbox>
                      </div>
                    )
                  }
                  return (
                    <div key={child.key} style={{ marginBottom: 4 }}>
                      <Checkbox checked={childChecked} indeterminate={childIndeterminate} onChange={e => {
                        const ck = collectKeys(child.children!)
                        if (e.target.checked) { onChange([...new Set([...checked, ...ck])]) }
                        else { onChange(checked.filter(k => !ck.includes(k))) }
                      }} style={{ fontSize: 13 }}>{child.label}</Checkbox>
                      <div style={{ paddingLeft: 24 }}>
                        {child.children!.map(gc => (
                          <div key={gc.key} style={{ marginBottom: 1 }}>
                            <Checkbox checked={checked.includes(gc.key)} onChange={e => {
                              if (e.target.checked) { onChange([...checked, gc.key]) }
                              else { onChange(checked.filter(k => k !== gc.key)) }
                            }} style={{ fontSize: 12 }}>{gc.label}</Checkbox>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function UserPermTab() {
  const [users, setUsers] = useState<any[]>([])
  const [editUser, setEditUser] = useState<any>(null)
  const [userKeys, setUserKeys] = useState<string[]>([])

  useEffect(() => {
    api.get('/settings/users', { params: { limit: 200 } }).then(r => setUsers((r.data?.data || []).filter((u: any) => u.username !== 'admin' && u.status !== -1)))
  }, [])

  const openEdit = async (u: any) => {
    setEditUser(u)
    setUserKeys([])
    try { const r = await api.get(`/settings/users/${u.id}/roles`); setUserKeys(r.data?.map((x: any) => x.id.toString()) || []) }
    catch { }
  }

  const savePerms = async () => {
    if (!editUser) return
    try { await api.put(`/settings/users/${editUser.id}/permissions`, { permissions: userKeys }); message.success('已更新'); setEditUser(null) }
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
        <MenuCheckbox items={roleMenus.ops?.menus || []} checked={userKeys} onChange={setUserKeys} />
      </Modal>
    </>
  )
}

function RolePermTab() {
  const [roles, setRoles] = useState<any[]>([])
  const [editRole, setEditRole] = useState<any>(null)
  const [roleKeys, setRoleKeys] = useState<string[]>([])

  useEffect(() => {
    api.get('/settings/roles').then(r => setRoles(r.data || []))
  }, [])

  const openEdit = async (role: any) => {
    setEditRole(role)
    setRoleKeys(role.permissions || [])
  }

  const savePerms = async () => {
    if (!editRole) return
    try { await api.put(`/settings/roles/${editRole.id}/permissions`, { permissions: roleKeys }); message.success('已更新'); setEditRole(null) }
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
        <MenuCheckbox items={roleMenus.ops?.menus || []} checked={roleKeys} onChange={setRoleKeys} />
      </Modal>
    </>
  )
}
