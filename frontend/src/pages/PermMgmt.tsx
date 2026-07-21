import { useEffect, useState } from 'react'
import { Input, Button, Typography, message, Tabs, Checkbox, Card, Row, Col, Segmented, Space } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api } from '../lib/api'
import { roleMenus, type MenuItem } from '../config/menus'

const { Text } = Typography

// 功能权限定义：每个菜单 key → 操作权限列表
const FEATURE_PERMS: Record<string, { key: string; label: string }[]> = {
  'scrape-configs': [
    { key: 'scrape-configs:view', label: '查看目标' },
    { key: 'scrape-configs:create', label: '新增目标' },
    { key: 'scrape-configs:edit', label: '编辑目标' },
    { key: 'scrape-configs:delete', label: '删除目标' },
    { key: 'scrape-configs:toggle', label: '禁用/启用' },
    { key: 'scrape-configs:folder:view', label: '查看文件夹' },
    { key: 'scrape-configs:folder:create', label: '新建文件夹' },
    { key: 'scrape-configs:folder:delete', label: '删除文件夹' },
    { key: 'scrape-configs:file:view', label: '查看配置文件' },
    { key: 'scrape-configs:file:create', label: '新建配置文件' },
    { key: 'scrape-configs:file:delete', label: '删除配置文件' },
  ],
  rules: [
    { key: 'rules:view', label: '查看规则' },
    { key: 'rules:create', label: '创建规则' },
    { key: 'rules:edit', label: '编辑规则' },
    { key: 'rules:delete', label: '删除规则' },
    { key: 'rules:toggle', label: '禁用/启用' },
  ],
  'alertmanager-silences': [
    { key: 'silence:view', label: '查看静默' },
    { key: 'silence:create', label: '创建静默' },
    { key: 'silence:expire', label: '过期静默' },
    { key: 'silence:delete', label: '删除静默' },
  ],
  'strategy-config': [
    { key: 'strategy:view', label: '查看策略' },
    { key: 'strategy:create', label: '创建策略' },
    { key: 'strategy:edit', label: '编辑策略' },
    { key: 'strategy:delete', label: '删除策略' },
    { key: 'strategy:toggle', label: '禁用/启用' },
  ],
  'user-mgmt': [
    { key: 'user:view', label: '查看用户' },
    { key: 'user:create', label: '新增用户' },
    { key: 'user:edit', label: '编辑用户' },
    { key: 'user:delete', label: '删除用户' },
    { key: 'user:toggle', label: '禁用/启用' },
    { key: 'user:role', label: '分配角色' },
  ],
} as const

function findMenuLabel(key: string): string {
  const find = (items: MenuItem[]): string | null => {
    for (const item of items) {
      if (item.key === key) return item.label
      if (item.children) {
        const r = find(item.children)
        if (r) return r
      }
    }
    return null
  }
  return find(roleMenus.ops?.menus || []) || key
}

// 管理权限 = 菜单权限全集 + 功能权限全集（下拉树）
function MgmtPermList({ checked, onChange }: { checked: string[]; onChange: (k: string[]) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const menuItems = roleMenus.ops?.menus || []

  const renderLeaf = (key: string, label: string, perms?: { key: string; label: string }[]) => {
    if (!perms || perms.length === 0) {
      return (
        <div key={key} style={{ margin: '3px 0' }}>
          <Checkbox checked={checked.includes(key)} onChange={e => {
            if (e.target.checked) onChange([...checked, key])
            else onChange(checked.filter(k => k !== key))
          }} style={{ fontSize: 14, color: '#555' }}>{label}</Checkbox>
        </div>
      )
    }
    const allKeys = [key, ...perms.map(p => p.key)]
    const allChecked = allKeys.every(k => checked.includes(k))
    const someChecked = allKeys.some(k => checked.includes(k))
    const isExpanded = expanded[key] ?? false
    return (
      <div key={key} style={{ marginBottom: 6, background: '#fff', borderRadius: 6, border: '1px solid #f0f0f0', padding: '6px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span onClick={() => setExpanded({ ...expanded, [key]: !isExpanded })}
            style={{ cursor: 'pointer', fontSize: 10, color: '#999', width: 14, textAlign: 'center', userSelect: 'none' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <Checkbox checked={allChecked} indeterminate={!allChecked && someChecked}
            onChange={e => {
              if (e.target.checked) onChange([...new Set([...checked, ...allKeys])])
              else onChange(checked.filter(k => !allKeys.includes(k)))
            }} style={{ fontWeight: 600, fontSize: 14 }}>
            {label}
          </Checkbox>
        </div>
        {isExpanded && (
          <div style={{ paddingLeft: 24, marginTop: 4, paddingTop: 4, borderTop: '1px dashed #f0f0f0' }}>
            {perms.map(p => (
              <div key={p.key} style={{ margin: '4px 0' }}>
                <Checkbox checked={checked.includes(p.key)} onChange={e => {
                  if (e.target.checked) onChange([...checked, p.key])
                  else onChange(checked.filter(k => k !== p.key))
                }} style={{ fontSize: 13, color: '#555' }}>{p.label}</Checkbox>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderNode = (item: MenuItem, depth: number): React.ReactNode => {
    if (item.key === 'overview') return null
    const perms = FEATURE_PERMS[item.key]
    if (item.children && item.children.length > 0) {
      return (
        <div key={item.key} style={{ marginBottom: 6, paddingLeft: depth * 8 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#333', marginBottom: 6 }}>{item.label}</div>
          {item.children.map(child => renderNode(child, depth + 1))}
        </div>
      )
    }
    return <div key={item.key} style={{ paddingLeft: depth * 8 }}>{renderLeaf(item.key, item.label, perms)}</div>
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
      {menuItems.map(item => renderNode(item, 0))}
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

function MenuTree({ checked, onChange }: { checked: string[]; onChange: (k: string[]) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const items = roleMenus.ops?.menus || []

  const allItemsChecked = (its: MenuItem[]): boolean => its.every(i => {
    if (i.children) return allItemsChecked(i.children)
    return checked.includes(i.key)
  })
  const someItemsChecked = (its: MenuItem[]): boolean => its.some(i => {
    if (i.children) return someItemsChecked(i.children)
    return checked.includes(i.key)
  })

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
      {items.map(item => {
        if (item.key === 'overview') return null
        const hasChildren = item.children && item.children.length > 0
                const isExpanded = expanded[item.key] ?? false
        return (
          <div key={item.key} style={{ marginBottom: 8, background: '#fff', borderRadius: 6, border: '1px solid #f0f0f0', padding: '6px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {hasChildren ? (
                <span onClick={() => setExpanded({ ...expanded, [item.key]: !isExpanded })}
                  style={{ cursor: 'pointer', fontSize: 12, color: '#999', width: 16, textAlign: 'center', userSelect: 'none', lineHeight: '22px' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              ) : <span style={{ width: 16 }} />}
              <Checkbox checked={allItemsChecked(item.children || [item] as MenuItem[])}
                indeterminate={hasChildren && someItemsChecked(item.children!) && !allItemsChecked(item.children!)}
                onChange={e => {
                  const ks = hasChildren ? collectKeys(item.children!) : [item.key]
                  if (e.target.checked) onChange([...new Set([...checked, ...ks])])
                  else onChange(checked.filter(k => !ks.includes(k)))
                }}
                style={{ fontWeight: hasChildren ? 600 : 400, fontSize: 14 }}>{item.label}</Checkbox>
            </div>
            {hasChildren && isExpanded && (
              <div style={{ paddingLeft: 28, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #f0f0f0' }}>
                {item.children!.map(child => {
                  const gc = child.children?.length ? child.children : undefined
                  const childChecked = gc ? allItemsChecked(gc) : checked.includes(child.key)
                  const childIndeterminate = gc && someItemsChecked(gc) && !allItemsChecked(gc)
                  return (
                    <div key={child.key} style={{ marginBottom: gc ? 8 : 4 }}>
                      {gc ? (
                        <>
                          <Checkbox checked={childChecked} indeterminate={childIndeterminate}
                            onChange={e => {
                              const ks = collectKeys(gc)
                              if (e.target.checked) onChange([...new Set([...checked, ...ks])])
                              else onChange(checked.filter(k => !ks.includes(k)))
                            }} style={{ fontSize: 13 }}>{child.label}</Checkbox>
                          <div style={{ paddingLeft: 24, paddingTop: 4 }}>
                            {gc.map(g => (
                              <div key={g.key} style={{ margin: '4px 0' }}>
                                <Checkbox checked={checked.includes(g.key)} onChange={e => {
                                  if (e.target.checked) onChange([...checked, g.key])
                                  else onChange(checked.filter(k => k !== g.key))
                                }} style={{ fontSize: 13, color: '#555' }}>{g.label}</Checkbox>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <Checkbox checked={childChecked} onChange={e => {
                          if (e.target.checked) onChange([...checked, child.key])
                          else onChange(checked.filter(k => k !== child.key))
                        }} style={{ fontSize: 13 }}>{child.label}</Checkbox>
                      )}
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

function FeaturePermList({ checked, onChange, filter }: { checked: string[]; onChange: (k: string[]) => void; filter?: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const entries = Object.entries(FEATURE_PERMS).filter(([k]) => !filter || k === filter)
  // 系统管理 tab 扁平展示，无父级分组
  if (filter && entries.length === 1) {
    const perms = entries[0][1]
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {perms.map(p => (
          <div key={p.key} style={{ margin: '8px 0', padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <Checkbox checked={checked.includes(p.key)} onChange={e => {
              if (e.target.checked) onChange([...checked, p.key])
              else onChange(checked.filter(k => k !== p.key))
            }} style={{ fontSize: 14, color: '#333' }}>{p.label}</Checkbox>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
      {entries.map(([menuKey, perms]) => {
        const label = findMenuLabel(menuKey)
        const allChecked = perms.every(p => checked.includes(p.key))
        const someChecked = perms.some(p => checked.includes(p.key))
        const isExpanded = expanded[menuKey] ?? false
        return (
          <div key={menuKey} style={{ marginBottom: 8, background: '#fff', borderRadius: 6, border: '1px solid #f0f0f0', padding: '6px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span onClick={() => setExpanded({ ...expanded, [menuKey]: !isExpanded })}
                style={{ cursor: 'pointer', fontSize: 12, color: '#999', width: 16, textAlign: 'center', userSelect: 'none', lineHeight: '22px' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
              <Checkbox checked={allChecked} indeterminate={!allChecked && someChecked}
                onChange={e => {
                  const ks = perms.map(p => p.key)
                  if (e.target.checked) onChange([...new Set([...checked, ...ks])])
                  else onChange(checked.filter(k => !ks.includes(k)))
                }} style={{ fontWeight: 600, fontSize: 14 }}>
                {label}
              </Checkbox>
            </div>
            {isExpanded && (
              <div style={{ paddingLeft: 28, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #f0f0f0' }}>
                {perms.map(p => (
                  <div key={p.key} style={{ margin: '5px 0', padding: '2px 0' }}>
                    <Checkbox checked={checked.includes(p.key)} onChange={e => {
                      if (e.target.checked) onChange([...checked, p.key])
                      else onChange(checked.filter(k => k !== p.key))
                    }} style={{ fontSize: 13, color: '#555' }}>{p.label}</Checkbox>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PermMgmt() {
  return (
    <div style={{ padding: 16 }}>
      <style>{`.ant-select-focused .ant-select-selector,.ant-select-selector:focus{box-shadow:none!important;outline:none!important}.ant-input-affix-wrapper:focus,.ant-input-affix-wrapper-focused{box-shadow:none!important;outline:none!important}`}</style>
      <Tabs items={[
        { key: 'users', label: '用户权限', children: <UserPermPane /> },
        { key: 'roles', label: '角色权限', children: <RolePermPane /> },
      ]} />
    </div>
  )
}

function UserPermPane() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [permKeys, setPermKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [permMode, setPermMode] = useState('menu')

  const loadUsers = async () => {
    const r = await api.get('/settings/users', { params: { limit: 200 } })
    setUsers((r.data?.data || []).filter((u: any) => u.username !== 'admin' && u.status !== -1))
  }
  useEffect(() => { loadUsers() }, [])

  const filtered = search ? users.filter(u => u.username.includes(search) || (u.displayName || '').includes(search)) : users

  const selectUser = async (u: any) => {
    setSelected(u)
    try { const r = await api.get(`/settings/users/${u.id}/permissions`); setPermKeys(r.data || []) }
    catch { setPermKeys([]) }
  }

  const savePerms = async () => {
    if (!selected) return
    setSaving(true)
    try { await api.put(`/settings/users/${selected.id}/permissions`, { permissions: permKeys }); message.success('已更新') }
    catch { message.error('操作失败') }; setSaving(false)
  }

  return (
    <Row gutter={16} style={{ height: 'calc(100vh - 180px)' }}>
      <Col span={8}>
        <Card size="small" styles={{ body: { padding: 12, height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa' } }}>
          <Input size="small" placeholder="搜索" prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} variant="borderless" style={{ borderBottom: '1px solid #d9d9d9', marginBottom: 8 }} />
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filtered.map(u => (
              <div key={u.id} onClick={() => selectUser(u)}
                style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4, marginBottom: 2, background: selected?.id === u.id ? '#e6f4ff' : '#fff', border: selected?.id === u.id ? '1px solid #1677ff' : '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><strong style={{ fontSize: 13 }}>{u.displayName || u.username}</strong><br /><Text type="secondary" style={{ fontSize: 11 }}>{u.department || '-'}</Text></div>
                <Text type="secondary" style={{ fontSize: 11 }}>{u.username}</Text>
              </div>
            ))}
          </div>
        </Card>
      </Col>
      <Col span={16}>
        <Card size="small" styles={{ body: { padding: 12, height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa' } }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                <Segmented size="small" value={permMode} onChange={v => setPermMode(v as string)}
                  options={[{ value: 'menu', label: '菜单权限' }, { value: 'feature', label: '功能权限' }, { value: 'mgmt', label: '管理权限' }]} />
                <Space>
                  <Text style={{ fontSize: 13, color: '#666' }}>{selected.displayName || selected.username}</Text>
                  <Button type="primary" size="small" loading={saving} onClick={savePerms}>保存</Button>
                </Space>
              </div>
              {permMode === 'menu'
                ? <MenuTree checked={permKeys} onChange={setPermKeys} />
                : permMode === 'mgmt'
                ? <MgmtPermList checked={permKeys} onChange={setPermKeys} />
                : <FeaturePermList checked={permKeys} onChange={setPermKeys} />
              }
            </>
          ) : (
            <div style={{ color: '#999', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>请选择左侧用户</div>
          )}
        </Card>
      </Col>
    </Row>
  )
}

function RolePermPane() {
  const [roles, setRoles] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [permKeys, setPermKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [permMode, setPermMode] = useState('menu')

  const loadRoles = async () => {
    const r = await api.get('/settings/roles')
    setRoles(r.data || [])
  }
  useEffect(() => { loadRoles() }, [])

  const filtered = search ? roles.filter(r => r.label.includes(search) || r.name.includes(search)) : roles

  const selectRole = (r: any) => {
    setSelected(r)
    setPermKeys(r.permissions || [])
  }

  const savePerms = async () => {
    if (!selected) return
    setSaving(true)
    try { await api.put(`/settings/roles/${selected.id}/permissions`, { permissions: permKeys }); message.success('已更新'); loadRoles() }
    catch { message.error('操作失败') }; setSaving(false)
  }

  return (
    <Row gutter={16} style={{ height: 'calc(100vh - 180px)' }}>
      <Col span={8}>
        <Card size="small" styles={{ body: { padding: 12, height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa' } }}>
          <Input size="small" placeholder="搜索" prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} variant="borderless" style={{ borderBottom: '1px solid #d9d9d9', marginBottom: 8 }} />
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filtered.map(r => (
              <div key={r.id} onClick={() => selectRole(r)}
                style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4, marginBottom: 2, background: selected?.id === r.id ? '#e6f4ff' : '#fff', border: selected?.id === r.id ? '1px solid #1677ff' : '1px solid #f0f0f0' }}>
                <div><strong style={{ fontSize: 13 }}>{r.label}</strong><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.description || r.name}</Text></div>
              </div>
            ))}
          </div>
        </Card>
      </Col>
      <Col span={16}>
        <Card size="small" styles={{ body: { padding: 12, height: '100%', display: 'flex', flexDirection: 'column', background: '#fafafa' } }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                <Segmented size="small" value={permMode} onChange={v => setPermMode(v as string)}
                  options={[{ value: 'menu', label: '菜单权限' }, { value: 'feature', label: '功能权限' }, { value: 'mgmt', label: '管理权限' }]} />
                <Space>
                  <Text style={{ fontSize: 13, color: '#666' }}>{selected.label}</Text>
                  <Button type="primary" size="small" loading={saving} onClick={savePerms}>保存</Button>
                </Space>
              </div>
              {permMode === 'menu'
                ? <MenuTree checked={permKeys} onChange={setPermKeys} />
                : permMode === 'mgmt'
                ? <MgmtPermList checked={permKeys} onChange={setPermKeys} />
                : <FeaturePermList checked={permKeys} onChange={setPermKeys} />
              }
            </>
          ) : (
            <div style={{ color: '#999', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>请选择左侧角色</div>
          )}
        </Card>
      </Col>
    </Row>
  )
}
