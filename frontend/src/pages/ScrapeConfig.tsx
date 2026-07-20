import { useEffect, useState, useMemo } from 'react'
import {
  Card, Row, Col, Button, Table, Tag, Space, Modal, Input, message, Popconfirm, Empty, Tooltip, Checkbox, Select,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined,
  FolderOutlined, FolderOpenOutlined, FileOutlined, AppstoreOutlined, FolderAddOutlined, CheckSquareOutlined,
} from '@ant-design/icons'
import {
  fetchTargets, fetchDirectories, createTarget, updateTarget, deleteTarget as apiDeleteTarget,
  toggleTarget, createDirectory, deleteDirectory, deleteFile, type ScrapeTarget, type DirectoryItem,
} from '../lib/scrape'

const STATUS_LABEL: Record<number, string> = { 1: '启用', 0: '禁用', '-1': '已删除' }
const PAGE_OPTIONS = [20, 50, 100]

export default function ScrapeConfig() {
  const [data, setData] = useState<ScrapeTarget[]>([])
  const [dirs, setDirs] = useState<DirectoryItem[]>([])
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScrapeTarget | null>(null)
  const [configModal, setConfigModal] = useState(false)
  const [folderModal, setFolderModal] = useState(false)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<number>>(new Set())
  const [selectedFileKeys, setSelectedFileKeys] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)

  const loadAll = async () => {
    try {
      const [t, d] = await Promise.all([fetchTargets(), fetchDirectories()])
      setData(t)
      setDirs(d)
    } catch { /* ignore */ }
  }
  useEffect(() => { loadAll() }, [])

  // Build tree structure from directories
  const tree = useMemo(() => {
    const deptMap: Record<string, { item: DirectoryItem; files: DirectoryItem[] }> = {}
    for (const d of dirs) {
      if (d.enabled === -1) continue
      if (!d.category) {
        deptMap[d.name] = deptMap[d.name] || { item: d, files: [] }
        deptMap[d.name].item = d
      } else {
        deptMap[d.name] = deptMap[d.name] || { item: null as any, files: [] }
        deptMap[d.name].files.push(d)
      }
    }
    return Object.entries(deptMap).sort(([a], [b]) => a.localeCompare(b))
  }, [dirs])

  const filtered = useMemo(() => {
    let items = data.filter((t) => t.status !== -1)
    if (selectedDept) items = items.filter((t) => t.department === selectedDept)
    if (selectedCat) items = items.filter((t) => t.category === selectedCat)
    return items
  }, [data, selectedDept, selectedCat])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  useEffect(() => { setPage(1) }, [selectedDept, selectedCat])

  const toggleExpand = (dept: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept); else next.add(dept)
      return next
    })
  }

  const handleAddConfigFile = (dept: string) => {
    setSelectedDept(dept)
    setConfigModal(true)
  }

  const handleDeleteTarget = async (id: number) => {
    await apiDeleteTarget(id)
    message.success('已删除')
    const remaining = filtered.filter((t) => t.id !== id)
    if (remaining.length === 0) setSelectedCat(null)
    await loadAll()
  }

  const handleToggleTarget = async (id: number) => {
    await toggleTarget(id)
    await loadAll()
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
          <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1677ff' }} />} onClick={() => { setEditTarget(r); setSelectedDept(r.department); setSelectedCat(r.category); setModalOpen(true) }} />
          <Popconfirm title={r.status === 1 ? '确认禁用？' : '确认启用？'} onConfirm={() => handleToggleTarget(r.id)}>
            <Button size="small" type="text" icon={<StopOutlined style={{ color: r.status === 1 ? '#fa8c16' : '#999' }} />} />
          </Popconfirm>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteTarget(r.id)}>
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
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={selectedIds.size + selectedFolderIds.size + selectedFileKeys.size === 0} onClick={async () => {
                    // Delete files
                    for (const key of selectedFileKeys) {
                      const [dept, cat] = key.split('|')
                      try { await deleteFile(dept, cat) } catch {}
                    }
                    // Delete folders
                    for (const fid of selectedFolderIds) {
                      try { await deleteDirectory(fid) } catch {}
                    }
                    // Delete targets
                    for (const id of selectedIds) {
                      const t = data.find((x) => x.id === id)
                      if (t) await apiDeleteTarget(id)
                    }
                    const total = selectedFolderIds.size + selectedIds.size + selectedFileKeys.size
                    message.success(`已删除 ${total} 项`)
                    setSelectedIds(new Set())
                    setSelectedFolderIds(new Set())
                    setSelectedFileKeys(new Set())
                    setSelectMode(false)
                    await loadAll()
                  }}>删除</Button>
                  <Button size="small" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); setSelectedFolderIds(new Set()); setSelectedFileKeys(new Set()) }}>取消</Button>
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
            {tree.map(([dept, { item, files }]) => {
              const expanded = expandedDepts.has(dept)
              const activeFolder = selectedDept === dept && !selectedCat
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
                    {selectMode ? (
                      <Checkbox
                        checked={selectedFolderIds.has(item?.id || -1)}
                        onChange={(e) => {
                          e.stopPropagation()
                          const fid = item?.id || -1
                          const next = new Set(selectedFolderIds)
                          e.target.checked ? next.add(fid) : next.delete(fid)
                          setSelectedFolderIds(next)
                          // 单向级联：勾选文件夹 → 自动勾选所有子文件；取消文件夹 → 取消所有子文件
                          const fileNext = new Set(selectedFileKeys)
                          for (const f of files) {
                            const key = `${dept}|${f.category}`
                            e.target.checked ? fileNext.add(key) : fileNext.delete(key)
                          }
                          setSelectedFileKeys(fileNext)
                        }}
                      />
                    ) : (
                      expanded ? <FolderOpenOutlined style={{ fontSize: 14 }} /> : <FolderOutlined style={{ fontSize: 14 }} />
                    )}
                    <span style={{ flex: 1, fontSize: 13 }}>{dept}</span>
                    {!selectMode && (
                      <Tooltip title="新增配置">
                        <Button size="small" type="text" icon={<PlusOutlined style={{ fontSize: 11 }} />} onClick={(e) => {
                          e.stopPropagation(); handleAddConfigFile(dept)
                        }} />
                      </Tooltip>
                    )}
                  </div>
                  {expanded && files.map((f) => {
                    const activeCat = selectedCat === f.category
                    return (
                      <div
                        key={f.category}
                        onClick={() => { if (!selectMode) { setSelectedDept(dept); setSelectedCat(f.category) } }}
                        style={{
                          padding: '5px 10px 5px 32px', borderRadius: 4, cursor: 'pointer', marginTop: 1,
                          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                          background: activeCat ? '#f0f5ff' : 'transparent',
                          color: activeCat ? '#1677ff' : '#666',
                        }}
                      >
                        {selectMode ? (
                          <Checkbox
                            checked={selectedFileKeys.has(`${dept}|${f.category}`)}
                            onChange={(e) => {
                              e.stopPropagation()
                              const key = `${dept}|${f.category}`
                              const next = new Set(selectedFileKeys)
                              e.target.checked ? next.add(key) : next.delete(key)
                              setSelectedFileKeys(next)
                            }}
                          />
                        ) : (
                          <FileOutlined style={{ fontSize: 13 }} />
                        )}
                        <span style={{ flex: 1 }}>{f.category}.yaml</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{selectedDept || '全部'}{selectedCat ? ` / ${selectedCat}.yaml` : ''}</span>
              {selectedCat && (
                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => { setEditTarget(null); setModalOpen(true) }}>新增目标</Button>
              )}
            </div>
          }
          style={{ height: '100%' }}
          styles={{ body: { padding: 12, overflow: 'auto', height: 'calc(100% - 38px)' } }}
        >
          {selectedCat ? (
            <Table
              rowKey="id" size="small"
              dataSource={paginated}
              columns={columns}
              pagination={{
                current: page,
                pageSize,
                total: filtered.length,
                onChange: (p, ps) => { setPage(p); if (ps) setPageSize(ps) },
                showSizeChanger: true,
                pageSizeOptions: PAGE_OPTIONS,
                showTotal: (t) => `共 ${t} 条`,
              }}
            />
          ) : filtered.length > 0 ? (
            <Table
              rowKey="id" size="small"
              dataSource={paginated}
              columns={[
                { title: '部门', dataIndex: 'department', width: 120 },
                { title: '分类', dataIndex: 'category', width: 100 },
                { title: '目标地址', dataIndex: 'target', ellipsis: true },
                { title: '状态', dataIndex: 'status', width: 70, render: (s: number) => <Tag color={s === 1 ? 'green' : 'orange'}>{STATUS_LABEL[s]}</Tag> },
              ]}
              pagination={{
                current: page,
                pageSize,
                total: filtered.length,
                onChange: (p, ps) => { setPage(p); if (ps) setPageSize(ps) },
                showSizeChanger: true,
                pageSizeOptions: PAGE_OPTIONS,
                showTotal: (t) => `共 ${t} 条`,
              }}
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
        dirs={dirs}
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
          await loadAll()
        }}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
      />

      <ConfigFileModal
        open={configModal}
        dept={selectedDept || ''}
        onSave={async (cat, desc) => {
          await createDirectory({ name: selectedDept || '', category: cat, description: desc })
          message.success('配置文件已创建')
          setConfigModal(false)
          await loadAll()
        }}
        onClose={() => setConfigModal(false)}
      />

      <FolderModal
        open={folderModal}
        onSave={async (name, description) => {
          await createDirectory({ name, description })
          message.success('文件夹已创建')
          setFolderModal(false)
          await loadAll()
        }}
        onClose={() => setFolderModal(false)}
      />
    </Row>
  )
}

function TargetModal({ open, editTarget, dirs, contextDept, contextCat, onSave, onClose }: {
  open: boolean
  editTarget: ScrapeTarget | null
  dirs: DirectoryItem[]
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

  const deptOptions = useMemo(() => {
    const names = [...new Set(dirs.filter((d) => !d.category && d.enabled !== -1).map((d) => d.name))]
    return names.sort().map((n) => ({ value: n, label: n }))
  }, [dirs])

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
              <div style={{ fontSize: 13, color: '#666', padding: '6px 0' }}>{contextDept} / {contextCat}.yaml</div>
            ) : contextDept && !contextCat ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 13, color: '#666', padding: '6px 0' }}>{contextDept}</div>
                <Input style={{ flex: 1 }} placeholder="文件名" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Select style={{ flex: 1 }} value={dept || undefined} onChange={(v) => setDept(v)} placeholder="部门"
                  options={deptOptions} />
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
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>标签（每行 key=value）</div>
          <Input.TextArea rows={2} placeholder={"env=prod\nservice=node_exporter"} value={labelsText} onChange={(e) => setLabelsText(e.target.value)} />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>备注</div>
          <Input placeholder="非必填" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

function ConfigFileModal({ open, dept, onSave, onClose }: {
  open: boolean
  dept: string
  onSave: (category: string, description: string) => Promise<void>
  onClose: () => void
}) {
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (open) { setCategory(''); setDescription('') } }, [open])

  const handleOk = async () => {
    if (!category.trim()) { message.warning('请输入文件名'); return }
    setSubmitting(true)
    try { await onSave(category.trim(), description.trim()) } finally { setSubmitting(false) }
  }

  return (
    <Modal title={`新增配置文件 - ${dept}`} open={open} onCancel={onClose} onOk={handleOk} okText="创建" confirmLoading={submitting} width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>文件名</div>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} autoFocus addonAfter=".yaml" placeholder="例：node、api、redis" />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>描述</div>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

function FolderModal({ open, onSave, onClose }: {
  open: boolean
  onSave: (name: string, description: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (open) { setName(''); setDescription('') } }, [open])

  const handleOk = async () => {
    if (!name.trim()) { message.warning('请输入名称'); return }
    setSubmitting(true)
    try { await onSave(name.trim(), description.trim()) } finally { setSubmitting(false) }
  }

  return (
    <Modal title="新建文件夹" open={open} onCancel={onClose} onOk={handleOk} okText="创建" confirmLoading={submitting} width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input placeholder="描述" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  )
}
