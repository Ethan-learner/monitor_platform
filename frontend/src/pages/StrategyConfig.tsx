import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, Select, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface Strategy { id: number; name: string; label: string; description: string; config: Record<string, Record<string, string[]>>; enabled: number }

const SEV_LEVELS = ['critical', 'warning', 'info'] as const
type SevLevel = typeof SEV_LEVELS[number]
const SEV_LABELS: Record<SevLevel, string> = { critical: '严重 critical', warning: '警告 warning', info: '信息 info' }
const SEV_SHORT: Record<string, string> = { critical: '严重', warning: '警告', info: '信息' }
const SEV_COLORS: Record<SevLevel, string> = { critical: '#cf1322', warning: '#d48806', info: '#1677ff' }
const FMT = { marginBottom: 14 }

const getHighestLevel = (cfg: Record<string, Record<string, string[]>>) => {
  return SEV_LEVELS.find(l => cfg[l] && Object.keys(cfg[l]).length > 0)
}
const sevNotifiyStr = (cfg: Record<string, Record<string, string[]>>, sev: SevLevel) => {
  const ch = cfg[sev] || {}
  const parts: string[] = []
  if (ch.email && ch.email.length > 0) parts.push(`邮件:${ch.email.join(',')}`)
  if (ch.lark && ch.lark.length > 0) parts.push(`飞书:${ch.lark.join(',')}`)
  return parts.length > 0 ? parts.join(' | ') : '—'
}

interface FlatRow { key: string; sid: number; name: string; label: string; description: string; enabled: number; config: Record<string, Record<string, string[]>>; sev: SevLevel; rowSpan: number }

export default function StrategyConfig() {
  const [data, setData] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Strategy | null>(null)
  const [deleteRefs, setDeleteRefs] = useState(0)
  const [dupModal, setDupModal] = useState(false)
  const [form] = Form.useForm()
  const [maxLevel, setMaxLevel] = useState<SevLevel>('critical')

  const load = async () => { setLoading(true); try { setData((await api.get('/alerts/strategies')).data) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const getCfgStr = (cfg: any, sev: string) => {
    const ch = cfg?.[sev] || {}
    return Object.entries(ch).map(([k, v]) => `${k}:${(v as string[]).join(',')}`).join('; ')
  }

  const visibleLevels = (level: SevLevel) => SEV_LEVELS.slice(SEV_LEVELS.indexOf(level))

  const flatData = useMemo(() => {
    const rows: FlatRow[] = []
    for (const d of data.filter(x => x.enabled !== -1)) {
      const hl = getHighestLevel(d.config) || 'critical'
      const levels = visibleLevels(hl)
      levels.forEach((sev, i) => {
        rows.push({ key: `${d.id}_${sev}`, sid: d.id, name: d.name, label: d.label, description: d.description, enabled: d.enabled, config: d.config, sev, rowSpan: i === 0 ? levels.length : 0 })
      })
    }
    return rows
  }, [data])

  const saveConfig = async () => {
    const vals = form.getFieldsValue()
    if (!vals.name || !vals.label) { message.warning('请填写标识 (英文) 和显示名'); return }
    try {
      const buildCh = (s: string) => {
        const ch: Record<string, string[]> = {}
        if (!s) return ch
        s.split(';').forEach(part => {
          const [chan, recips] = part.split(':')
          if (chan && recips) ch[chan.trim()] = recips.split(',').map((r: string) => r.trim()).filter(Boolean)
        })
        return ch
      }
      const config: Record<string, Record<string, string[]>> = {}
      for (const sev of visibleLevels(maxLevel)) {
        config[sev] = buildCh(vals[`cfg_${sev}`] || '')
      }
      const body = { name: vals.name, label: vals.label, description: vals.description || '', config }
      if (editing) { await api.put(`/alerts/strategies/${editing.id}`, body); message.success('已更新') }
      else { await api.post('/alerts/strategies', body); message.success('已创建') }
      setModalOpen(false); form.resetFields(); setMaxLevel('critical'); setEditing(null); load()
    } catch (e: any) {
      if (e?.response?.status === 409) { setDupModal(true); return }
      message.error('保存失败')
    }
  }

  const handleEdit = (r: Strategy) => {
    setEditing(r)
    const highest = getHighestLevel(r.config) || 'critical'
    setMaxLevel(highest)
    form.setFieldsValue({
      name: r.name, label: r.label, description: r.description,
      cfg_critical: getCfgStr(r.config, 'critical'),
      cfg_warning: getCfgStr(r.config, 'warning'),
      cfg_info: getCfgStr(r.config, 'info'),
    })
    setModalOpen(true)
  }

  const resetModal = () => {
    setEditing(null); form.resetFields(); setMaxLevel('critical'); setModalOpen(true)
  }

  const handleDeleteStrategy = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/alerts/strategies/${deleteTarget.id}`)
      message.success(deleteRefs > 0 ? `策略已删除，${deleteRefs} 条规则已禁用` : '策略已删除')
      setDeleteTarget(null); load()
    } catch { message.error('删除失败') }
  }

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
          { title: '名称', dataIndex: 'label', width: 140, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }), render: (s: string, r) => <span><strong>{s || r.name}</strong></span> },
          { title: '标识', dataIndex: 'name', width: 120, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }), render: (s: string) => <code>{s}</code> },
          { title: '说明', dataIndex: 'description', ellipsis: true, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }) },
          { title: '告警级别', width: 80, align: 'center', onCell: (r) => ({ rowSpan: r.rowSpan }), render: (_: any, r: FlatRow) => {
            const hl = getHighestLevel(r.config)
            return hl ? <Tag color={SEV_COLORS[hl]}>{SEV_SHORT[hl]}</Tag> : <span style={{ color: '#999' }}>—</span>
          }},
          { title: '通知策略', width: 280, align: 'center', render: (_: any, r: FlatRow) => (
            <span style={{ fontSize: 12 }}><Tag color={SEV_COLORS[r.sev]} style={{ marginRight: 4 }}>{SEV_SHORT[r.sev]}</Tag>{sevNotifiyStr(r.config, r.sev)}</span>
          )},
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
                if (s.enabled === 1) {
                  const { data: refs } = await api.get(`/alerts/strategies/${s.id}/refs`)
                  const msg = refs.count > 0 ? `有 ${refs.count} 条规则正在使用此策略，禁用后这些规则将无法推送通知，确认禁用？` : '确认禁用该策略？'
                  if (!confirm(msg)) return
                }
                const newEnabled = s.enabled === 1 ? 0 : 1
                await api.put(`/alerts/strategies/${s.id}/disable`, { enabled: newEnabled }); load()
              }}>
                <StopOutlined style={{ color: r.enabled === 1 ? '#fa8c16' : '#999', transform: r.enabled === 1 ? 'none' : 'rotate(180deg)' }} />
              </Button>
              <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} onClick={async () => {
                const s = data.find(d => d.id === r.sid)
                if (!s) return
                const { data: refs } = await api.get(`/alerts/strategies/${s.id}/refs`)
                setDeleteTarget(s); setDeleteRefs(refs.count || 0)
              }} />
            </Space>
          )},
        ]}
      />

      <Modal title={editing ? '编辑策略' : '新增策略'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={620}>
        <Form form={form} layout="vertical">
          <Form.Item label="标识 (英文)" name="name" rules={[{ required: true }]} style={FMT}><Input placeholder="" /></Form.Item>
          <Form.Item label="显示名" name="label" rules={[{ required: true }]} style={FMT}><Input placeholder="" /></Form.Item>
          <Form.Item label="说明" name="description" style={FMT}><Input placeholder="" /></Form.Item>
          <Form.Item label="覆盖级别" style={{ marginBottom: 18 }}>
            <Select value={maxLevel} onChange={v => setMaxLevel(v)} options={SEV_LEVELS.map(l => ({ label: SEV_LABELS[l as SevLevel], value: l }))} />
          </Form.Item>
          {SEV_LEVELS.map(sev => (
            <Form.Item key={sev} name={`cfg_${sev}`} label={<span style={{ color: SEV_COLORS[sev] }}>{SEV_LABELS[sev]}</span>} style={{ marginBottom: 14, display: visibleLevels(maxLevel).includes(sev) ? 'block' : 'none' }}>
              <Input placeholder="email:a@x.com; lark:id1" />
            </Form.Item>
          ))}
          <Space><Button type="primary" onClick={saveConfig}>保存</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>
      <Modal title="提示" open={dupModal} onCancel={() => setDupModal(false)} footer={null}>
        <p>标识 (英文) 已存在，请更换名称。</p>
      </Modal>
        <p>策略: <strong>{deleteTarget?.label || deleteTarget?.name}</strong></p>
        {deleteRefs > 0 ? <p style={{ color: '#cf1322' }}>有 {deleteRefs} 条规则引用了此策略，删除后将自动禁用这些规则。</p> : <p>确认删除该策略？</p>}
      </Modal>
    </div>
  )
}
