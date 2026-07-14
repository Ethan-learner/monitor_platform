import { useEffect, useState } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, Select, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface Strategy { id: number; name: string; label: string; description: string; config: Record<string, Record<string, string[]>>; enabled: number }

const SEV_LEVELS = ['critical', 'warning', 'info'] as const
type SevLevel = typeof SEV_LEVELS[number]
const SEV_LABELS: Record<SevLevel, string> = { critical: '严重 critical', warning: '警告 warning', info: '信息 info' }
const SEV_COLORS: Record<SevLevel, string> = { critical: '#cf1322', warning: '#d48806', info: '#1677ff' }
const FMT = { marginBottom: 10 }

export default function StrategyConfig() {
  const [data, setData] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [form] = Form.useForm()
  const [cfg, setCfg] = useState<Record<string, string>>({ critical: '', warning: '', info: '' })
  const [maxLevel, setMaxLevel] = useState<SevLevel>('critical')

  const load = async () => { setLoading(true); try { setData((await api.get('/alerts/strategies')).data) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const getCfgStr = (cfg: any, sev: string) => {
    const ch = cfg?.[sev] || {}
    return Object.entries(ch).map(([k, v]) => `${k}:${(v as string[]).join(',')}`).join('; ')
  }

  const visibleLevels = (level: SevLevel) => SEV_LEVELS.slice(0, SEV_LEVELS.indexOf(level) + 1)

  const handleSave = async (values: any) => {
    const buildCh = (s: string) => {
      const ch: Record<string, string[]> = {}
      if (!s) return ch
      s.split(';').forEach(part => {
        const [chan, recips] = part.split(':')
        if (chan && recips) ch[chan.trim()] = recips.split(',').map((r: string) => r.trim()).filter(Boolean)
      })
      return ch
    }
    const config = Object.fromEntries(visibleLevels(maxLevel).map((l: SevLevel) => [l, buildCh(cfg[l] || '')]))
    const body = { ...values, config }
    try {
      if (editing) { await api.put(`/alerts/strategies/${editing.id}`, body); message.success('已更新') }
      else { await api.post('/alerts/strategies', body); message.success('已创建') }
      setModalOpen(false); form.resetFields(); setCfg({ critical: '', warning: '', info: '' }); setMaxLevel('critical'); setEditing(null); load()
    } catch { message.error('保存失败') }
  }

  const handleEdit = (r: Strategy) => {
    setEditing(r)
    form.setFieldsValue({ name: r.name, label: r.label, description: r.description })
    const highest = SEV_LEVELS.find(l => r.config[l] && Object.keys(r.config[l]).length > 0)
    setMaxLevel((highest || 'critical') as SevLevel)
    setCfg({
      critical: getCfgStr(r.config, 'critical'),
      warning: getCfgStr(r.config, 'warning'),
      info: getCfgStr(r.config, 'info'),
    })
    setModalOpen(true)
  }

  const resetModal = () => {
    setEditing(null); form.resetFields()
    setCfg({ critical: '', warning: '', info: '' }); setMaxLevel('critical'); setModalOpen(true)
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

      <Table<Strategy>
        rowKey="id" dataSource={data.filter(d => d.enabled !== -1)} size="middle" pagination={false} bordered
        columns={[
          { title: '名称', dataIndex: 'label', width: 150, align: 'center', render: (s: string, r) => <span><strong>{s || r.name}</strong></span> },
          { title: '标识', dataIndex: 'name', width: 130, align: 'center', render: (s: string) => <code>{s}</code> },
          { title: '说明', dataIndex: 'description', ellipsis: true, align: 'center' },
          { title: 'critical', width: 160, align: 'center', render: (_, r) => <span style={{ fontSize: 12, color: r.config?.critical?.email?.length ? '#cf1322' : '#999' }}>{getCfgStr(r.config, 'critical') || '—'}</span> },
          { title: 'warning', width: 160, align: 'center', render: (_, r) => <span style={{ fontSize: 12, color: r.config?.warning?.email?.length ? '#d48806' : '#999' }}>{getCfgStr(r.config, 'warning') || '—'}</span> },
          { title: '状态', width: 70, align: 'center', render: (_, r) => {
            if (r.enabled === 1) return <Tag color="green">启用</Tag>
            if (r.enabled === 0) return <Tag color="orange">禁用</Tag>
            return <Tag color="red">已删除</Tag>
          }},
          { title: '操作', width: 140, align: 'center', render: (_, r) => (
            <Space>
              <Button size="small" type="text" onClick={async () => {
                if (r.enabled === 1) {
                  const { data: refs } = await api.get(`/alerts/strategies/${r.id}/refs`)
                  const msg = refs.count > 0 ? `有 ${refs.count} 条规则正在使用此策略，禁用后这些规则将无法推送通知，确认禁用？` : '确认禁用该策略？'
                  if (!confirm(msg)) return
                }
                const newEnabled = r.enabled === 1 ? 0 : 1
                await api.put(`/alerts/strategies/${r.id}/disable`, { enabled: newEnabled }); load()
              }}>
                <StopOutlined style={{ color: r.enabled === 1 ? '#fa8c16' : '#999', transform: r.enabled === 1 ? 'none' : 'rotate(180deg)' }} />
              </Button>
              <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} onClick={() => handleEdit(r)} />
              <Popconfirm title="确认删除？" onConfirm={async () => { await api.delete(`/alerts/strategies/${r.id}`); load() }}>
                <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
              </Popconfirm>
            </Space>
          )},
        ]}
      />

      <Modal title={editing ? '编辑策略' : '新增策略'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={620}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label="标识 (英文)" name="name" rules={[{ required: true }]} style={FMT}><Input placeholder="ops_critical" /></Form.Item>
          <Form.Item label="显示名" name="label" rules={[{ required: true }]} style={FMT}><Input placeholder="运维紧急通知" /></Form.Item>
          <Form.Item label="说明" name="description" style={FMT}><Input placeholder="用于生产环境 critical 告警" /></Form.Item>
          <Form.Item label="覆盖级别" style={FMT}>
            <Select value={maxLevel} onChange={v => setMaxLevel(v)} options={SEV_LEVELS.map(l => ({ label: SEV_LABELS[l as SevLevel], value: l }))} />
          </Form.Item>
          {visibleLevels(maxLevel).map(sev => (
            <Form.Item key={sev} label={<span style={{ color: SEV_COLORS[sev] }}>{SEV_LABELS[sev]}</span>} help="格式: email:a@x.com; lark:id1" style={FMT}>
              <Input placeholder="email:a@x.com; lark:id1" value={cfg[sev]} onChange={e => setCfg(p => ({ ...p, [sev]: e.target.value }))} />
            </Form.Item>
          ))}
          <Space><Button type="primary" htmlType="submit">保存</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}
