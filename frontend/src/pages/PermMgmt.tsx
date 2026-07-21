import { useEffect, useState } from 'react'
import { Input, Button, Typography, message, Tabs, Checkbox, Card, Row, Col } from 'antd'
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
    { key: 'scrape-configs:folder', label: '管理文件夹' },
    { key: 'scrape-configs:file', label: '管理配置文件' },
  ],
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
    const perms = FEATURE_PERMS[i.key]
    if (perms) return perms.every(p => checked.includes(p.key))
    return checked.includes(i.key)
  })
  const someItemsChecked = (its: MenuItem[]): boolean => its.some(i => {
    if (i.children) return someItemsChecked(i.children)
    const perms = FEATURE_PERMS[i.key]
    if (perms) return perms.some(p => checked.includes(p.key))
    return checked.includes(i.key)
  })

  const renderLeaf = (key: string, label: string, depth: number) => {
    const perms = FEATURE_PERMS[key]
    if (perms) {
      const allChecked = perms.every(p => checked.includes(p.key))
      const someChecked = perms.some(p => checked.includes(p.key))
      return (
        <div style={{ paddingLeft: depth * 22 }}>
          <Checkbox checked={allChecked} indeterminate={!allChecked && someChecked}
            onChange={e => {
              const ks = perms.map(p => p.key)
              if (e.target.checked) onChange([...new Set([...checked, ...ks])])
              else onChange(checked.filter(k => !ks.includes(k)))
            }} style={{ fontSize: 12 - depth * 1 }}>{label}</Checkbox>
          <div style={{ paddingLeft: 22 }}>
            {perms.map(p => (
              <div key={p.key} style={{ margin: '1px 0' }}>
                <Checkbox checked={checked.includes(p.key)} onChange={e => {
                  if (e.target.checked) onChange([...checked, p.key])
                  else onChange(checked.filter(k => k !== p.key))
                }} style={{ fontSize: 11, color: '#666' }}>◉ {p.label}</Checkbox>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div style={{ paddingLeft: depth * 22 }}>
        <Checkbox checked={checked.includes(key)} onChange={e => {
          if (e.target.checked) onChange([...checked, key])
          else onChange(checked.filter(k => k !== key))
        }} style={{ fontSize: 12 - depth * 1 }}>{label}</Checkbox>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
      {items.map(item => {
        if (item.key === 'overview') return null
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expanded[item.key] ?? false
        return (
          <div key={item.key} style={{ marginBottom: hasChildren ? 10 : 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {hasChildren ? (
                <span onClick={() => setExpanded({ ...expanded, [item.key]: !isExpanded })}
                  style={{ cursor: 'pointer', fontSize: 10, color: '#999', width: 14, textAlign: 'center', userSelect: 'none' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              ) : <span style={{ width: 14 }} />}
              <Checkbox checked={allItemsChecked(item.children || [item] as MenuItem[])}
                indeterminate={hasChildren && someItemsChecked(item.children!) && !allItemsChecked(item.children!)}
                onChange={e => {
                  const ks = hasChildren ? collectKeys(item.children!) : [item.key]
                  if (e.target.checked) {
                    const allKs = [...new Set([...checked, ...ks])]
                    // 级联子操作权限
                    if (!hasChildren) {
                      const perms = FEATURE_PERMS[item.key]
                      if (perms) perms.forEach(p => allKs.push(p.key))
                    }
                    onChange([...new Set(allKs)])
                  } else {
                    let filtered = checked.filter(k => !ks.includes(k))
                    // 级联移除子操作权限
                    if (!hasChildren) {
                      const perms = FEATURE_PERMS[item.key]
                      if (perms) filtered = filtered.filter(k => !perms.some(p => p.key === k))
                    }
                    onChange(filtered)
                  }
                }}
                style={{ fontWeight: hasChildren ? 600 : 400, fontSize: 13 }}>{item.label}</Checkbox>
            </div>
            {hasChildren && isExpanded && (
              <div style={{ paddingLeft: 22, marginTop: 2 }}>
                {item.children!.map(child => {
                  const gc = child.children?.length ? child.children : undefined
                  return (
                    <div key={child.key} style={{ marginBottom: gc ? 6 : 1 }}>
                      {gc ? (
                        <>
                          <Checkbox checked={allItemsChecked(gc)} indeterminate={someItemsChecked(gc) && !allItemsChecked(gc)}
                            onChange={e => {
                              const ks = collectKeys(gc)
                              if (e.target.checked) onChange([...new Set([...checked, ...ks])])
                              else onChange(checked.filter(k => !ks.includes(k)))
                            }} style={{ fontSize: 12 }}>{child.label}</Checkbox>
                          <div style={{ paddingLeft: 22 }}>
                            {gc.map(g => renderLeaf(g.key, g.label, 2))}
                          </div>
                        </>
                      ) : renderLeaf(child.key, child.label, 1)}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: '#666', fontSize: 12 }}>编辑权限: <strong>{selected.displayName || selected.username}</strong></span>
                <Button type="primary" size="small" loading={saving} onClick={savePerms}>保存权限</Button>
              </div>
              <MenuTree checked={permKeys} onChange={setPermKeys} />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: '#666', fontSize: 12 }}>编辑权限: <strong>{selected.label}</strong></span>
                <Button type="primary" size="small" loading={saving} onClick={savePerms}>保存权限</Button>
              </div>
              <MenuTree checked={permKeys} onChange={setPermKeys} />
            </>
          ) : (
            <div style={{ color: '#999', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>请选择左侧角色</div>
          )}
        </Card>
      </Col>
    </Row>
  )
}
