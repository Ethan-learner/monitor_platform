import { useEffect, useState, useMemo } from 'react'
import {
  Card, Row, Col, Button, Table, Tag, Space, Modal, Input, Select, message, Popconfirm, Empty, Tooltip, Checkbox,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, ReloadOutlined,
  FolderOutlined, FolderOpenOutlined, FileOutlined, AppstoreOutlined, FolderAddOutlined, CheckSquareOutlined,
} from '@ant-design/icons'
import { fetchTargets, fetchCategories, createTarget, updateTarget, deleteTarget, toggleTarget, syncFromServer, type ScrapeTarget, type CategoryInfo } from '../lib/scrape'

const STATUS_LABEL: Record<number, string> = { 1: '启用', 0: '禁用', '-1': '已删除' }

export default function ScrapeConfig() {
  const [data, setData] = useState<ScrapeTarget[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [, forceLoad] = useState(0)
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScrapeTarget | null>(null)
  const [folderModal, setFolderModal] = useState(false)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const load = async () => {
    try {
      const [t, c] = await Promise.all([fetchTargets(), fetchCategories()])
      setData(t)
      setCategories(c)
    } catch { forceLoad((n) => n + 1) }
  }
  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const m: Record<string, Record<string, ScrapeTarget[]>> = {}
    for (const t of data) {
      if (t.status === -1) continue
      m[t.department] = m[t.department] || {}
      m[t.department][t.category] = m[t.department][t.category] || []
      m[t.department][t.category].push(t)
    }
    return m
  }, [data])

  const departments = useMemo(() => Object.keys(grouped).sort(), [grouped])

  const filtered = useMemo(() => {
    let items = data.filter((t) => t.status !== -1)
    if (selectedDept) items = items.filter((t) => t.department === selectedDept)
    if (selectedCat) items = items.filter((t) => t.category === selectedCat)
    return items
  }, [data, selectedDept, selectedCat])

  const catInfo = useMemo(() => {
    const m: Record<string, CategoryInfo> = {}
    for (const c of categories) m[`${c.department}/${c.category}`] = c
    return m
  }, [categories])

  const toggleExpand = (dept: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept); else next.add(dept)
      return next
    })
  }

  const handleEdit = (item: ScrapeTarget) => {
    setEditTarget(item)
    setSelectedDept(item.department)
    setSelectedCat(item.category)
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    await deleteTarget(id)
    message.success('已删除')
    const remaining = filtered.filter((t) => t.id !== id)
    if (remaining.length === 0) { setSelectedCat(null) }
    await load()
  }

  const handleToggle = async (id: number) => {
    await toggleTarget(id)
    await load()
  }

  const columns = [
    { title: '目标地址', dataIndex: 'target', width: 300 },
    {
      title: '标签', key: 'labels', render: (_: any, r: ScrapeTarget) => (
        <Space size={4} wrap>
          {Object.entries(r.labels).map(([k, v]) => <Tag key={k} color="blue" style={{ margin: 0 }}>{k}={v}</Tag>)}
        </Space>
      ),
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 70,
      render: (s: number) => <Tag color={s === 1 ? 'green' : 'orange'}>{STATUS_LABEL[s]}</Tag>,
    },
    {
      title: '操作', width: 130,
      render: (_: any, r: ScrapeTarget) => (
        <Space>
          <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1677ff' }} />} onClick={() => handleEdit(r)} />
          <Popconfirm title={r.status === 1 ? '确认禁用？' : '确认启用？'} onConfirm={() => handleToggle(r.id)}>
            <Button size="small" type="text" icon={<StopOutlined style={{ color: r.status === 1 ? '#fa8c16' : '#999' }} />} />
          </Popconfirm>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Row gutter={12} style={{ height: 'calc(100vh - 84px)', padding: 12 }}>
      <Col span={5}>
        <Card
          size="small"
          title={
            <Space style={{ width: '100%', justifyContent: 'space-between' }} size={0}>
              {selectMode ? (
                <Space size={4}>
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={selectedIds.size === 0} onClick={async () => {
                    for (const id of selectedIds) await deleteTarget(id)
                    message.success(`已删除 ${selectedIds.size} 项`)
                    setSelectedIds(new Set())
                    setSelectMode(false)
                    await load()
                  }}>删除</Button>
                  <Button size="small" onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}>取消</Button>
                </Space>
              ) : (
                <>
                  <span style={{ fontSize: 14 }}>文件列表</span>
                  <Space size={2}>
                    <Tooltip title="选择">
                      <Button size="small" type="text" icon={<CheckSquareOutlined />} onClick={() => setSelectMode(true)} />
                    </Tooltip>
                    <Tooltip title="新建文件夹">
                      <Button size="small" type="text" icon={<FolderAddOutlined />} onClick={() => setFolderModal(true)} />
                    </Tooltip>
                  </Space>
                </>
              )}
            </Space>
          }
          style={{ height: '100%' }}
          styles={{ body: { padding: '8px 12px', overflow: 'auto', height: 'calc(100% - 38px)' } }}
        >
          <div
            onClick={() => { if (!selectMode) { setSelectedDept(null); setSelectedCat(null) } }}
            style={{
              padding: '6px 10px', borderRadius: 4, cursor: 'pointer', marginBottom: 4,
              display: 'flex', alignItems: 'center', gap: 8,
              background: !selectedDept ? '#e6f4ff' : 'transparent',
              color: !selectedDept ? '#1677ff' : '#333', fontWeight: !selectedDept ? 600 : 400,
            }}
          >
            <AppstoreOutlined style={{ fontSize: 14 }} />
            <span style={{ flex: 1 }}>全部</span>
          </div>

          <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0', paddingTop: 4 }}>
            {departments.map((dept) => {
              const cats = grouped[dept] || {}
              const catKeys = Object.keys(cats).sort()
              const expanded = expandedDepts.has(dept)
              const activeFolder = selectedDept === dept && !selectedCat
              const total = catKeys.reduce((s, k) => s + cats[k].length, 0)
              return (
                <div key={dept} style={{ marginBottom: 1 }}>
                  <div
                    onClick={() => { if (!selectMode) { toggleExpand(dept); setSelectedDept(dept); setSelectedCat(null) } }}
                    style={{
                      padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: activeFolder ? '#e6f4ff' : 'transparent',
                      color: activeFolder ? '#1677ff' : '#333', fontWeight: activeFolder ? 600 : 400,
                    }}
                  >
                    {expanded ? <FolderOpenOutlined style={{ fontSize: 14 }} /> : <FolderOutlined style={{ fontSize: 14 }} />}
                    <span style={{ flex: 1, fontSize: 13 }}>{dept}</span>
                    <span style={{ fontSize: 11, color: '#999' }}>{total}</span>
                  </div>
                  {expanded && catKeys.map((ck) => {
                    const items = cats[ck]
                    const activeCat = selectedCat === ck
                    return (
                      <div
                        key={ck}
                        onClick={() => { if (!selectMode) { setSelectedDept(dept); setSelectedCat(ck) } }}
                        style={{
                          padding: '5px 10px 5px 32px', borderRadius: 4, cursor: 'pointer', marginTop: 1,
                          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                          background: activeCat ? '#f0f5ff' : 'transparent',
                          color: activeCat ? '#1677ff' : '#666',
                        }}
                      >
                        {selectMode ? (
                          <Checkbox checked={items.every((t) => selectedIds.has(t.id))}
                            indeterminate={items.some((t) => selectedIds.has(t.id)) && !items.every((t) => selectedIds.has(t.id))}
                            onChange={(e) => {
                              e.stopPropagation()
                              const next = new Set(selectedIds)
                              for (const t of items) e.target.checked ? next.add(t.id) : next.delete(t.id)
                              setSelectedIds(next)
                            }} />
                        ) : (
                          <FileOutlined style={{ fontSize: 13 }} />
                        )}
                        <span style={{ flex: 1 }}>{ck}.yaml</span>
                        <span style={{ fontSize: 11, color: '#999' }}>{items.length}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </Card>
      </Col>

      <Col span={19}>
        <Card
          size="small"
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Space>
                <span>{selectedDept || '全部'} {selectedCat ? `/ ${selectedCat}.yaml` : ''}</span>
              </Space>
              {selectedCat && (
                <Space size={2}>
                  <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => {
                    setEditTarget(null)
                    setModalOpen(true)
                  }} />
                  <Popconfirm title="确认同步？将覆盖本地修改" onConfirm={async () => {
                    const r = await syncFromServer()
                    message.success(`已同步 ${r.synced} 项`)
                    await load()
                  }}>
                    <Button size="small" type="text" icon={<ReloadOutlined />} />
                  </Popconfirm>
                </Space>
              )}
            </div>
          }
          style={{ height: '100%' }}
          styles={{ body: { padding: 12, overflow: 'auto', height: 'calc(100% - 38px)' } }}
        >
          {selectedCat ? (
            filtered.length > 0 ? (
              <Table rowKey="id" size="small" pagination={false} dataSource={filtered} columns={columns} />
            ) : (
              <Empty description="暂无目标" style={{ marginTop: 80 }} />
            )
          ) : filtered.length > 0 ? (
            <Table
              rowKey="id" size="small" pagination={false}
              dataSource={filtered}
              columns={[
                { title: '部门', dataIndex: 'department', width: 120 },
                { title: '分类', dataIndex: 'category', width: 100 },
                { title: '目标地址', dataIndex: 'target', ellipsis: true },
                {
                  title: '状态', dataIndex: 'status', width: 70,
                  render: (s: number) => <Tag color={s === 1 ? 'green' : 'orange'}>{STATUS_LABEL[s]}</Tag>,
                },
              ]}
              onRow={(r) => ({ onClick: () => { setSelectedDept(r.department); setSelectedCat(r.category) }, style: { cursor: 'pointer' } })}
            />
          ) : (
            <Empty description="暂无数据" style={{ marginTop: 80 }} />
          )}
        </Card>
      </Col>

      <TargetModal
        open={modalOpen}
        editTarget={editTarget}
        departments={departments}
        contextDept={selectedDept}
        contextCat={selectedCat}
        onSave={async (values) => {
          if (editTarget) {
            await updateTarget(editTarget.id, values)
          } else {
            await createTarget(values)
          }
          setModalOpen(false)
          setEditTarget(null)
          await load()
        }}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
      />

      <FolderModal
        open={folderModal}
        onSave={async (name) => {
          message.success('文件夹已创建')
          setFolderModal(false)
        }}
        onClose={() => setFolderModal(false)}
      />
    </Row>
  )
}

function TargetModal({ open, editTarget, departments, contextDept, contextCat, onSave, onClose }: {
  open: boolean
  editTarget: ScrapeTarget | null
  departments: string[]
  contextDept: string | null
  contextCat: string | null
  onSave: (values: any) => Promise<void>
  onClose: () => void
}) {
  const [dept, setDept] = useState(editTarget?.department || contextDept || '')
  const [category, setCategory] = useState(editTarget?.category || contextCat || '')
  const [target, setTarget] = useState(editTarget?.target || '')
  const [labelsText, setLabelsText] = useState(
    editTarget ? Object.entries(editTarget.labels).map(([k, v]) => `${k}=${v}`).join('\n') : ''
  )
  const [desc, setDesc] = useState(editTarget?.description || '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setDept(editTarget?.department || contextDept || '')
      setCategory(editTarget?.category || contextCat || '')
      setTarget(editTarget?.target || '')
      setLabelsText(editTarget ? Object.entries(editTarget.labels).map(([k, v]) => `${k}=${v}`).join('\n') : '')
      setDesc(editTarget?.description || '')
    }
  }, [editTarget, contextDept, contextCat, open])

  const handleOk = async () => {
    if (!editTarget && !dept) { message.warning('请选择文件夹'); return }
    if (!editTarget && !category.trim()) { message.warning('请输入文件名'); return }
    if (!target.trim()) { message.warning('请输入目标地址'); return }
    setSubmitting(true)
    try {
      await onSave({
        department: editTarget ? editTarget.department : dept,
        category: category.trim(),
        target: target.trim(),
        labels: labelsText,
        description: desc,
      })
    } finally { setSubmitting(false) }
  }

  return (
    <Modal
      title={editTarget ? `编辑目标：${editTarget.target}` : '新增目标'}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={editTarget ? '保存' : '创建'}
      confirmLoading={submitting}
      width={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 4px' }}>
        {!editTarget && (
          <div>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>所属文件</div>
            {contextDept && contextCat ? (
              <div style={{ fontSize: 13, color: '#666', padding: '6px 0' }}>
                {contextDept} / {contextCat}.yaml
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Select style={{ flex: 1 }} value={dept || undefined} onChange={setDept} placeholder="部门"
                  options={departments.map((d) => ({ value: d, label: d }))} />
                <Input style={{ flex: 1 }} placeholder="文件名" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>目标地址</div>
          <Input placeholder="10.0.1.27:9100" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>标签（每行 key=value，同文件共用）</div>
          <Input.TextArea rows={2} placeholder={"env=prod\nservice=node_exporter"}
            value={labelsText} onChange={(e) => setLabelsText(e.target.value)} />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>备注</div>
          <Input placeholder="非必填" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

function FolderModal({ open, onSave, onClose }: {
  open: boolean
  onSave: (name: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (open) setName('') }, [open])

  const handleOk = async () => {
    if (!name.trim()) { message.warning('请输入名称'); return }
    setSubmitting(true)
    try { await onSave(name.trim()) } finally { setSubmitting(false) }
  }

  return (
    <Modal title="新建文件夹" open={open} onCancel={onClose} onOk={handleOk} okText="创建" confirmLoading={submitting} width={400}>
      <Input placeholder="数据治理部" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
    </Modal>
  )
}
