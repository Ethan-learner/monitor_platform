import { useEffect, useState, useMemo } from 'react'
import {
  Card, Row, Col, Button, Table, Tag, Space, Modal, Input, Select, message, Popconfirm, Empty, Tooltip, Checkbox,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, ReloadOutlined,
  FolderOutlined, FolderOpenOutlined, FileOutlined, AppstoreOutlined, FolderAddOutlined, CheckSquareOutlined,
} from '@ant-design/icons'
import { fetchTargets, createTarget, updateTarget, deleteTarget, toggleTarget, type ScrapeTarget } from '../lib/scrape'

const STATUS_LABEL: Record<number, string> = { 1: '启用', 0: '禁用', '-1': '已删除' }

export default function ScrapeConfig() {
  const [data, setData] = useState<ScrapeTarget[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScrapeTarget | null>(null)
  const [folderModal, setFolderModal] = useState(false)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const load = async () => {
    setLoading(true)
    try { setData(await fetchTargets()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const m: Record<string, ScrapeTarget[]> = {}
    for (const t of data) {
      if (t.status === -1) continue
      ;(m[t.department] = m[t.department] || []).push(t)
    }
    return m
  }, [data])

  const departments = useMemo(() => Object.keys(grouped).sort(), [grouped])

  const filtered = useMemo(() => {
    let items = data.filter((t) => t.status !== -1)
    if (selectedDept) items = items.filter((t) => t.department === selectedDept)
    return items
  }, [data, selectedDept])

  const currentItem = selectedCat ? filtered.find((t) => t.category === selectedCat) : null

  const toggleExpand = (dept: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept); else next.add(dept)
      return next
    })
  }

  const handleSave = async (values: any) => {
    try {
      if (editTarget) {
        await updateTarget(editTarget.id, values)
        message.success('已更新')
      } else {
        await createTarget(values)
        message.success('已创建')
      }
      setModalOpen(false)
      setEditTarget(null)
      await load()
    } catch { message.error('操作失败') }
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
    if (remaining.length === 0) { setSelectedCat(null); setSelectedDept(null) }
    await load()
  }

  const handleToggle = async (id: number) => {
    await toggleTarget(id)
    await load()
  }

  const listColumns = [
    { title: '文件名', dataIndex: 'category', render: (c: string) => `${c}.yaml` },
    { title: '目标数', dataIndex: 'targets', width: 80, align: 'center' as const, render: (t: string[]) => t?.length || 0 },
    {
      title: '标签', key: 'labels', render: (_: any, r: ScrapeTarget) => (
        <Space size={4} wrap>
          {Object.entries(r.labels).map(([k, v]) => <Tag key={k} color="blue" style={{ margin: 0 }}>{k}={v}</Tag>)}
        </Space>
      ),
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 70, align: 'center' as const,
      render: (s: number) => <Tag color={s === 1 ? 'green' : 'orange'}>{STATUS_LABEL[s]}</Tag>,
    },
    {
      title: '操作', width: 140, align: 'center' as const,
      render: (_: any, r: ScrapeTarget) => (
        <Space>
          <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1677ff' }} />} onClick={(e) => { e.stopPropagation(); handleEdit(r) }} />
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
              color: !selectedDept ? '#1677ff' : '#333',
              fontWeight: !selectedDept ? 600 : 400,
            }}
          >
            {selectMode && <Checkbox checked={departments.every((d) => grouped[d].every((c) => selectedIds.has(c.id)))} onChange={(e) => {
              if (e.target.checked) {
                const all = new Set<number>()
                for (const d of departments) for (const c of grouped[d]) all.add(c.id)
                setSelectedIds(all)
              } else {
                setSelectedIds(new Set())
              }
            }} />}
            <AppstoreOutlined style={{ fontSize: 14 }} />
            <span style={{ flex: 1 }}>全部</span>
          </div>

          <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0', paddingTop: 4 }}>
            {departments.map((dept) => {
              const cats = grouped[dept] || []
              const expanded = expandedDepts.has(dept)
              const activeFolder = selectedDept === dept && !selectedCat
              const deptAllSelected = cats.length > 0 && cats.every((c) => selectedIds.has(c.id))
              const deptSomeSelected = cats.some((c) => selectedIds.has(c.id))
              return (
                <div key={dept} style={{ marginBottom: 1 }}>
                  <div
                    onClick={() => { if (!selectMode) { toggleExpand(dept); setSelectedDept(dept); setSelectedCat(null) } }}
                    style={{
                      padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: activeFolder ? '#e6f4ff' : 'transparent',
                      color: activeFolder ? '#1677ff' : '#333',
                      fontWeight: activeFolder ? 600 : 400,
                    }}
                  >
                    {selectMode && (
                      <Checkbox
                        checked={deptAllSelected}
                        indeterminate={!deptAllSelected && deptSomeSelected}
                        onChange={(e) => {
                          e.stopPropagation()
                          const next = new Set(selectedIds)
                          for (const c of cats) {
                            if (e.target.checked) next.add(c.id)
                            else next.delete(c.id)
                          }
                          setSelectedIds(next)
                        }}
                      />
                    )}
                    {expanded ? <FolderOpenOutlined style={{ fontSize: 14 }} /> : <FolderOutlined style={{ fontSize: 14 }} />}
                    <span style={{ flex: 1, fontSize: 13 }}>{dept}</span>
                    {!selectMode && (
                      <Tooltip title="新增配置">
                        <Button size="small" type="text" icon={<PlusOutlined style={{ fontSize: 11 }} />} onClick={(e) => { e.stopPropagation(); setEditTarget(null); setSelectedDept(dept); setSelectedCat(null); setModalOpen(true) }} />
                      </Tooltip>
                    )}
                  </div>
                  {expanded && cats.map((cat) => (
                    <div
                      key={cat.category}
                      onClick={() => { if (!selectMode) { setSelectedDept(dept); setSelectedCat(cat.category) } }}
                      style={{
                        padding: '5px 10px 5px 32px', borderRadius: 4, cursor: 'pointer', marginTop: 1,
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                        background: selectedCat === cat.category ? '#f0f5ff' : 'transparent',
                        color: selectedCat === cat.category ? '#1677ff' : '#666',
                      }}
                    >
                      {selectMode ? (
                        <Checkbox checked={selectedIds.has(cat.id)} onChange={(e) => {
                          e.stopPropagation()
                          const next = new Set(selectedIds)
                          e.target.checked ? next.add(cat.id) : next.delete(cat.id)
                          setSelectedIds(next)
                        }} />
                      ) : (
                        <FileOutlined style={{ fontSize: 13 }} />
                      )}
                      <span style={{ flex: 1 }}>{cat.category}.yaml</span>
                      {cat.status === 0 && <StopOutlined style={{ fontSize: 11, color: '#faad14' }} />}
                    </div>
                  ))}
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
                {selectedCat && currentItem ? (
                  <span>{currentItem.department} / {currentItem.category}.yaml</span>
                ) : (
                  <span>{selectedDept || '全部'}</span>
                )}
                {currentItem && <Tag color={currentItem.status === 1 ? 'green' : 'orange'}>{STATUS_LABEL[currentItem.status]}</Tag>}
              </Space>
              {currentItem && (
                <Space size={2}>
                  <Button size="small" type="text" icon={<EditOutlined style={{ color: '#1677ff' }} />} onClick={() => handleEdit(currentItem)} />
                  <Popconfirm title={currentItem.status === 1 ? '确认禁用？' : '确认启用？'} onConfirm={() => handleToggle(currentItem.id)}>
                    <Button size="small" type="text" icon={<StopOutlined style={{ color: currentItem.status === 1 ? '#fa8c16' : '#999' }} />} />
                  </Popconfirm>
                  <Popconfirm title="确认删除？" onConfirm={() => handleDelete(currentItem.id)}>
                    <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
                  </Popconfirm>
                </Space>
              )}
            </div>
          }
          style={{ height: '100%' }}
          styles={{ body: { padding: 12, overflow: 'auto', height: 'calc(100% - 38px)' } }}
        >
          {selectedCat && currentItem ? (
            <div>
              <div style={{ marginBottom: 12, display: 'flex', gap: 24, fontSize: 13, color: '#666' }}>
                <span>描述：{currentItem.description || '无'}</span>
                <span>操作人：{currentItem.operator}</span>
                <span>创建时间：{currentItem.createdAt}</span>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500 }}>目标列表（{currentItem.targets.length}）</span>
                <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
              </div>
              <Table
                rowKey="i" size="small" pagination={false}
                dataSource={currentItem.targets.map((t, i) => ({ i, target: t }))}
                columns={[
                  { title: '#', dataIndex: 'i', width: 50, align: 'center', render: (i: number) => i + 1 },
                  { title: '目标地址', dataIndex: 'target', width: 300 },
                  { title: '协议', width: 80, render: () => 'http' },
                  {
                    title: '标签', render: () => (
                      <Space size={4} wrap>
                        {Object.entries(currentItem.labels).map(([k, v]) => <Tag key={k} color="blue" style={{ margin: 0 }}>{k}={v}</Tag>)}
                      </Space>
                    ),
                  },
                  { title: '状态', width: 70, render: () => <Tag color="green">UP</Tag> },
                ]}
              />
            </div>
          ) : filtered.length > 0 ? (
            <Table
              rowKey="id" size="small" pagination={false} dataSource={filtered}
              columns={listColumns}
              onRow={(r) => ({ onClick: () => { setSelectedDept(r.department); setSelectedCat(r.category) }, style: { cursor: 'pointer' } })}
            />
          ) : (
            <Empty description="暂无抓取配置" style={{ marginTop: 80 }} />
          )}
        </Card>
      </Col>

      <TargetModal
        open={modalOpen && !folderModal}
        editTarget={editTarget}
        departments={departments}
        contextDept={selectedDept}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
      />

      <FolderModal
        open={folderModal}
        onSave={async (name: string) => {
          await createTarget({ department: name, category: '_folder', targets: [], labels: '', description: '' })
          message.success('文件夹已创建')
          setFolderModal(false)
          await load()
        }}
        onClose={() => setFolderModal(false)}
      />
    </Row>
  )
}

function TargetModal({ open, editTarget, departments, contextDept, onSave, onClose }: {
  open: boolean
  editTarget: ScrapeTarget | null
  departments: string[]
  contextDept: string | null
  onSave: (values: any) => Promise<void>
  onClose: () => void
}) {
  const [dept, setDept] = useState(editTarget?.department || contextDept || '')
  const [category, setCategory] = useState(editTarget?.category || '')
  const [targetsText, setTargetsText] = useState((editTarget?.targets || []).join('\n'))
  const [labelsText, setLabelsText] = useState(
    editTarget ? Object.entries(editTarget.labels).map(([k, v]) => `${k}=${v}`).join('\n') : ''
  )
  const [desc, setDesc] = useState(editTarget?.description || '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setDept(editTarget?.department || contextDept || '')
      setCategory(editTarget?.category || '')
      setTargetsText(editTarget ? editTarget.targets.join('\n') : '')
      setLabelsText(editTarget ? Object.entries(editTarget.labels).map(([k, v]) => `${k}=${v}`).join('\n') : '')
      setDesc(editTarget?.description || '')
    }
  }, [editTarget, contextDept, open])

  const handleOk = async () => {
    if (!editTarget && !dept) { message.warning('请选择文件夹'); return }
    if (!editTarget && !category.trim()) { message.warning('请输入文件名'); return }
    if (!targetsText.trim()) { message.warning('请至少输入一个目标地址'); return }
    setSubmitting(true)
    try {
      await onSave({
        department: editTarget ? editTarget.department : dept,
        category: category.trim(),
        targets: targetsText.split('\n').map((s) => s.trim()).filter(Boolean),
        labels: labelsText,
        description: desc,
      })
    } finally { setSubmitting(false) }
  }

  return (
    <Modal
      title={editTarget ? `编辑：${editTarget.department}/${editTarget.category}.yaml` : '新增抓取配置'}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={editTarget ? '保存' : '创建'}
      confirmLoading={submitting}
      width={560}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 4px' }}>
        {!editTarget && (
          <div>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>所属文件夹</div>
            {contextDept ? (
              <div style={{ fontSize: 13, color: '#666', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FolderOutlined /> {contextDept}
              </div>
            ) : (
              <Select
                style={{ width: '100%' }}
                value={dept || undefined}
                onChange={setDept}
                placeholder="请选择文件夹"
                options={departments.map((d) => ({ value: d, label: d, icon: <FolderOutlined /> }))}
              />
            )}
          </div>
        )}
        {editTarget && (
          <div style={{ fontSize: 13, color: '#666', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileOutlined /> {editTarget.department}/{editTarget.category}.yaml
          </div>
        )}
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>文件名</div>
          <Input
            placeholder="例：node、api、redis、kafka"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={!!editTarget}
            addonAfter=".yaml"
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>目标地址（每行一个 host:port）</div>
          <Input.TextArea
            rows={4}
            placeholder={"10.0.1.27:9100\n10.0.1.28:9100\n10.0.1.29:9100"}
            value={targetsText}
            onChange={(e) => setTargetsText(e.target.value)}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>标签（每行一个 key=value）</div>
          <Input.TextArea
            rows={2}
            placeholder={"env=prod\nservice=node_exporter"}
            value={labelsText}
            onChange={(e) => setLabelsText(e.target.value)}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>备注</div>
          <Input placeholder="非必填" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

function FolderModal({ open, onSave, onClose }: { open: boolean; onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (open) setName('') }, [open])

  const handleOk = async () => {
    if (!name.trim()) { message.warning('请输入文件夹名称'); return }
    setSubmitting(true)
    try { await onSave(name.trim()) } finally { setSubmitting(false) }
  }

  return (
    <Modal title="新建文件夹" open={open} onCancel={onClose} onOk={handleOk} okText="创建" confirmLoading={submitting} width={400}>
      <div style={{ padding: '16px 4px' }}>
        <Input placeholder="数据治理部" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
    </Modal>
  )
}
