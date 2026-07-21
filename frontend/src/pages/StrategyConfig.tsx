import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Input, Select, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, ReloadOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface Strategy { id: number; name: string; label: string; description: string; config: Record<string, Record<string, string[]>>; enabled: number; created_at: string }

const SEV_LEVELS = ['critical', 'warning', 'info'] as const
type SevLevel = typeof SEV_LEVELS[number]
const SEV_LABELS: Record<SevLevel, string> = { critical: '严重 critical', warning: '警告 warning', info: '信息 info' }
const SEV_SHORT: Record<string, string> = { critical: '严重', warning: '警告', info: '信息' }
const SEV_COLORS: Record<SevLevel, string> = { critical: '#cf1322', warning: '#d48806', info: '#1677ff' }
const CHANNELS = ['email', 'lark'] as const
const CHANNEL_LABELS: Record<string, string> = { email: '邮件', lark: '飞书' }

type CfgState = Record<SevLevel, Record<string, string[]>>

interface FlatRow { key: string; sid: number; label: string; description: string; enabled: number; config: Record<string, Record<string, string[]>>; sev: SevLevel; rowSpan: number; created_at: string }

export default function StrategyConfig() {
  const [data, setData] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [dupModal, setDupModal] = useState(false)
  const [disableTarget, setDisableTarget] = useState<Strategy | null>(null)
  const [disableRefs, setDisableRefs] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<Strategy | null>(null)
  const [deleteRefs, setDeleteRefs] = useState(0)

  const load = async () => { setLoading(true); try { setData((await api.get('/alerts/strategies')).data) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const handleEdit = (r: Strategy) => { setEditing(r); setModalOpen(true) }
  const resetModal = () => { setEditing(null); setModalOpen(true) }

  const handleDisableStrategy = async () => {
    if (!disableTarget) return
    try {
      const newEnabled = disableTarget.enabled === 1 ? 0 : 1
      await api.put(`/alerts/strategies/${disableTarget.id}/disable`, { enabled: newEnabled })
      message.success(newEnabled === 0 ? '策略已禁用' : '策略已启用')
      setDisableTarget(null); load()
    } catch { message.error('操作失败') }
  }

  const handleDeleteStrategy = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/alerts/strategies/${deleteTarget.id}`)
      message.success(deleteRefs > 0 ? `策略已删除，${deleteRefs} 条规则已禁用` : '策略已删除')
      setDeleteTarget(null); load()
    } catch { message.error('删除失败') }
  }

  const getHighestLevel = (cfg: Record<string, Record<string, string[]>>) => {
    return SEV_LEVELS.find(l => cfg[l] && Object.keys(cfg[l]).length > 0)
  }
  const sevNotifiyStr = (cfg: Record<string, Record<string, string[]>>, sev: SevLevel) => {
    const ch = cfg[sev] || {}
    const parts: React.ReactNode[] = []
    for (const [chan, recips] of Object.entries(ch)) {
      if (recips && recips.length > 0) {
        parts.push(
          <span key={chan} style={{ display: 'block', marginBottom: 2, fontSize: 12 }}>
            <Tag color="blue" style={{ marginRight: 4 }}>{CHANNEL_LABELS[chan] || chan}</Tag>
            {recips.join(', ')}
          </span>
        )
      }
    }
    return parts.length > 0 ? <>{parts}</> : '—'
  }

  const visibleLevels = (level: SevLevel) => SEV_LEVELS.slice(SEV_LEVELS.indexOf(level))

  const flatData = useMemo(() => {
    const rows: FlatRow[] = []
    for (const d of data.filter(x => x.enabled !== -1)) {
      const hl = getHighestLevel(d.config) || 'info'
      const levels = visibleLevels(hl)
      levels.forEach((sev, i) => {
        rows.push({ key: `${d.id}_${sev}`, sid: d.id, label: d.label, description: d.description, enabled: d.enabled, config: d.config, sev, rowSpan: i === 0 ? levels.length : 0, created_at: d.created_at })
      })
    }
    return rows
  }, [data])

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>通知策略</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={resetModal}>新增策略</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>

      <Table<FlatRow>
        rowKey="key" dataSource={flatData} size="middle" pagination={false} bordered
        columns={[
          { title: '名称', dataIndex: 'label', width: 120, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }), render: (s: string) => <span><strong>{s}</strong></span> },
          { title: '创建时间', width: 140, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }), render: (_: any, r: FlatRow) => <span style={{ fontSize: 12 }}>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</span> },
          { title: '告警级别', width: 100, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }), render: (_: any, r: FlatRow) => {
            const hl = getHighestLevel(r.config)
            return hl ? <Tag color={SEV_COLORS[hl]}>{SEV_SHORT[hl]}</Tag> : <span style={{ color: '#999' }}>—</span>
          }},
          { title: '通知策略', width: 280, align: 'center', render: (_: any, r: FlatRow) => (
            <span style={{ fontSize: 12 }}><Tag color={SEV_COLORS[r.sev]} style={{ marginRight: 4 }}>{SEV_SHORT[r.sev]}</Tag>{sevNotifiyStr(r.config, r.sev)}</span>
          )},
          { title: '说明', dataIndex: 'description', ellipsis: true, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }) },
          { title: '状态', width: 60, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }), render: (_, r) => {
            if (r.enabled === 1) return <Tag color="green">启用</Tag>
            if (r.enabled === 0) return <Tag color="orange">禁用</Tag>
            return <Tag color="red">已删除</Tag>
          }},
          { title: '操作', width: 140, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }), render: (_: any, r: FlatRow) => (
            <Space>
              <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} onClick={() => handleEdit(data.find(d => d.id === r.sid)!)} />
              <Button size="small" type="text" onClick={async () => {
                const s = data.find(d => d.id === r.sid)
                if (!s) return
                const { data: refs } = await api.get(`/alerts/strategies/${s.id}/refs`)
                setDisableRefs(refs.count || 0)
                setDisableTarget(s)
              }}>
                <StopOutlined style={{ color: r.enabled === 1 ? '#fa8c16' : '#999', transform: r.enabled === 1 ? 'none' : 'rotate(180deg)' }} />
              </Button>
              <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} onClick={async () => {
                const s = data.find(d => d.id === r.sid)
                if (!s) return
                const { data: refs } = await api.get(`/alerts/strategies/${s.id}/refs`)
                setDeleteRefs(refs.count || 0)
                setDeleteTarget(s)
              }} />
            </Space>
          )},
        ]}
      />

      <Modal title={editing ? '编辑策略' : '新增策略'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={640}>
        <StrategyForm editing={editing} onSave={async (label, desc, config) => {
          try {
            const body: any = { label, description: desc, config }
            if (editing) {
              body.enabled = editing.enabled
              await api.put(`/alerts/strategies/${editing.id}`, body); message.success('已更新')
            } else {
              const res = (await api.post('/alerts/strategies', body)).data
              const msg = res.relinked > 0 ? `已创建，${res.relinked} 条规则已恢复链接` : '已创建'
              message.success(msg)
            }
            setModalOpen(false); setEditing(null); load()
          } catch (e: any) {
            if (e?.response?.status === 409) { setDupModal(true); return }
            message.error('保存失败')
          }
        }} onClose={() => setModalOpen(false)} />
      </Modal>

      <Modal title="提示" open={dupModal} onCancel={() => setDupModal(false)} footer={null}>
        <p>显示名已存在，请更换名称。</p>
      </Modal>
      <Modal title="确认操作" open={!!disableTarget} onCancel={() => setDisableTarget(null)} onOk={handleDisableStrategy}
        okText={disableTarget?.enabled === 1 ? '确认禁用' : '确认启用'}
        okButtonProps={disableTarget?.enabled === 1 ? { danger: true } : {}}>
        <p>策略: <strong>{disableTarget?.label}</strong></p>
        {disableTarget?.enabled === 1 && disableRefs > 0
          ? <p style={{ color: '#fa8c16' }}>有 {disableRefs} 条规则正在使用此策略，禁用后这些规则将无法推送通知。</p>
          : <p>{disableTarget?.enabled === 1 ? '确认禁用该策略？' : '确认启用该策略？'}</p>}
      </Modal>
      <Modal title="确认删除策略" open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onOk={handleDeleteStrategy} okText="确认删除" okButtonProps={{ danger: true }}>
        <p>策略: <strong>{deleteTarget?.label}</strong></p>
        {deleteRefs > 0 ? <p style={{ color: '#cf1322' }}>有 {deleteRefs} 条规则引用了此策略，删除后将自动禁用这些规则。</p> : <p>确认删除该策略？</p>}
      </Modal>
    </div>
  )
}

function StrategyForm({ editing, onSave, onClose }: { editing: Strategy | null; onSave: (label: string, desc: string, config: Record<string, Record<string, string[]>>) => Promise<void>; onClose: () => void }) {
  const [label, setLabel] = useState(editing?.label || '')
  const [desc, setDesc] = useState(editing?.description || '')
  const [maxLevel, setMaxLevel] = useState<SevLevel>('critical')
  const [cfg, setCfg] = useState<CfgState>({ critical: {}, warning: {}, info: {} })

  useEffect(() => {
    if (editing) {
      setLabel(editing.label)
      setDesc(editing.description || '')
      const hl = SEV_LEVELS.find(l => editing.config[l] && Object.keys(editing.config[l]).length > 0) || 'critical'
      setMaxLevel(hl)
      const init: CfgState = { critical: {}, warning: {}, info: {} }
      for (const sev of SEV_LEVELS) {
        for (const ch of CHANNELS) {
          init[sev][ch] = [...(editing.config[sev]?.[ch] || [])]
        }
      }
      setCfg(init)
    } else {
      setLabel(''); setDesc(''); setMaxLevel('critical')
      setCfg({ critical: {}, warning: {}, info: {} })
    }
  }, [editing])

  const addRecip = (sev: SevLevel, ch: string) => {
    setCfg(prev => {
      const next = { ...prev, [sev]: { ...prev[sev], [ch]: [...(prev[sev][ch] || []), ''] } }
      return next
    })
  }
  const setRecip = (sev: SevLevel, ch: string, idx: number, val: string) => {
    setCfg(prev => {
      const arr = [...(prev[sev][ch] || [])]
      arr[idx] = val
      return { ...prev, [sev]: { ...prev[sev], [ch]: arr } }
    })
  }
  const removeRecip = (sev: SevLevel, ch: string, idx: number) => {
    setCfg(prev => {
      const arr = [...(prev[sev][ch] || [])]
      arr.splice(idx, 1)
      return { ...prev, [sev]: { ...prev[sev], [ch]: arr } }
    })
  }

  const handleSave = async () => {
    if (!label.trim()) { message.warning('请填写显示名'); return }
    const config: Record<string, Record<string, string[]>> = {}
    for (const sev of SEV_LEVELS) {
      if (!visibleLevels(maxLevel).includes(sev)) { config[sev] = {}; continue }
      config[sev] = {}
      for (const ch of CHANNELS) {
        const recips = (cfg[sev]?.[ch] || []).map(r => r.trim()).filter(Boolean)
        if (recips.length > 0) config[sev][ch] = recips
      }
    }
    await onSave(label.trim(), desc.trim(), config)
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>显示名</div>
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="策略名称" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>说明</div>
        <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 4, fontSize: 13, color: '#333' }}>覆盖级别</div>
        <Select value={maxLevel} onChange={setMaxLevel} style={{ width: '100%' }}
          options={SEV_LEVELS.map(l => ({ value: l, label: SEV_LABELS[l] }))} />
      </div>
      {SEV_LEVELS.filter(l => visibleLevels(maxLevel).includes(l)).map(sev => (
        <div key={sev} style={{ marginBottom: 18, padding: '10px 12px', background: '#fafafa', borderRadius: 6 }}>
          <div style={{ fontWeight: 600, color: SEV_COLORS[sev], marginBottom: 10, fontSize: 13 }}>{SEV_LABELS[sev]}</div>
          {CHANNELS.map(ch => (
            <div key={ch} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{CHANNEL_LABELS[ch]}</div>
              {(cfg[sev]?.[ch] || []).map((val, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                  <Input size="small" value={val} onChange={e => setRecip(sev, ch, idx, e.target.value)}
                    placeholder={ch === 'email' ? 'zhangsan@longcheer.com' : '飞书 ID'} style={{ flex: 1 }} />
                  <Button size="small" type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeRecip(sev, ch, idx)} />
                </div>
              ))}
              <Button size="small" type="dashed" onClick={() => addRecip(sev, ch)} style={{ fontSize: 12 }}>
                + 添加{CHANNEL_LABELS[ch]}
              </Button>
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="primary" onClick={handleSave}>保存</Button>
        <Button onClick={onClose}>取消</Button>
      </div>
    </div>
  )
}

const visibleLevels = (level: SevLevel) => SEV_LEVELS.slice(SEV_LEVELS.indexOf(level))
