import { useEffect, useState } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, Select, Popconfirm, message, Card } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface Strategy { id: number; name: string; label: string; description: string; config: Record<string, Record<string, string[]>>; enabled: number }

export default function StrategyConfig() {
  const [data, setData] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [form] = Form.useForm()
  const [cfgCritical, setCfgCritical] = useState('')
  const [cfgWarning, setCfgWarning] = useState('')
  const [cfgInfo, setCfgInfo] = useState('')
  const [globals, setGlobals] = useState<any[]>([])
  const [globalModal, setGlobalModal] = useState(false)
  const [globalEditing, setGlobalEditing] = useState<any>(null)
  const [globalForm] = Form.useForm()
  const [globalRecipientInput, setGlobalRecipientInput] = useState('')

  const load = async () => { setLoading(true); try { setData((await api.get('/alerts/strategies')).data) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  useEffect(() => { api.get('/alerts/recipients').then(r => setGlobals(r.data || [])).catch(() => {}) }, [])

  const getCfgStr = (cfg: any, sev: string) => {
    const ch = cfg?.[sev] || {}
    return Object.entries(ch).map(([k, v]) => `${k}:${(v as string[]).join(',')}`).join('; ')
  }

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
    const config = { critical: buildCh(cfgCritical), warning: buildCh(cfgWarning), info: buildCh(cfgInfo) }
    const body = { ...values, config }
    try {
      if (editing) { await api.put(`/alerts/strategies/${editing.id}`, body); message.success('已更新') }
      else { await api.post('/alerts/strategies', body); message.success('已创建') }
      setModalOpen(false); form.resetFields(); setCfgCritical(''); setCfgWarning(''); setCfgInfo(''); setEditing(null); load()
    } catch { message.error('保存失败') }
  }

  const handleEdit = (r: Strategy) => {
    setEditing(r)
    form.setFieldsValue({ name: r.name, label: r.label, description: r.description })
    setCfgCritical(getCfgStr(r.config, 'critical'))
    setCfgWarning(getCfgStr(r.config, 'warning'))
    setCfgInfo(getCfgStr(r.config, 'info'))
    setModalOpen(true)
  }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>通知策略</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setCfgCritical(''); setCfgWarning(''); setCfgInfo(''); setModalOpen(true) }}>新增策略</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>

      <Table<Strategy>
        rowKey="id" dataSource={data} size="middle" pagination={false} bordered
        columns={[
          { title: '名称', dataIndex: 'label', width: 150, render: (s: string, r) => <span><strong>{s || r.name}</strong></span> },
          { title: '标识', dataIndex: 'name', width: 130, render: (s: string) => <code>{s}</code> },
          { title: '说明', dataIndex: 'description', ellipsis: true },
          { title: 'critical', width: 160, render: (_, r) => <span style={{ fontSize: 12, color: r.config?.critical?.email?.length ? '#cf1322' : '#999' }}>{getCfgStr(r.config, 'critical') || '—'}</span> },
          { title: 'warning', width: 160, render: (_, r) => <span style={{ fontSize: 12, color: r.config?.warning?.email?.length ? '#d48806' : '#999' }}>{getCfgStr(r.config, 'warning') || '—'}</span> },
          { title: '状态', width: 70, align: 'center', render: (_, r) => <Tag color={r.enabled ? 'green' : 'red'}>{r.enabled ? '启用' : '禁用'}</Tag> },
          { title: '操作', width: 100, align: 'center', render: (_, r) => (
            <Space>
              <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} onClick={() => handleEdit(r)} />
              <Popconfirm title="确认禁用？" onConfirm={async () => { await api.delete(`/alerts/strategies/${r.id}`); load() }}>
                <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
              </Popconfirm>
            </Space>
          )},
        ]}
      />

      <Modal title={editing ? '编辑策略' : '新增策略'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={650}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item label="标识 (英文)" name="name" rules={[{ required: true }]}><Input placeholder="ops_critical" /></Form.Item>
          <Form.Item label="显示名" name="label" rules={[{ required: true }]}><Input placeholder="运维紧急通知" /></Form.Item>
          <Form.Item label="说明" name="description"><Input placeholder="用于生产环境 critical 告警" /></Form.Item>
          <Form.Item label={<span style={{ color: '#cf1322' }}>Critical 配置</span>} help="格式: 通道:接收人; 通道:接收人 (如 email:a@x.com,b@x.com; lark:id1)">
            <Input placeholder="email:zhulei1@longcheer.com; lark:25171402" value={cfgCritical} onChange={e => setCfgCritical(e.target.value)} />
          </Form.Item>
          <Form.Item label={<span style={{ color: '#d48806' }}>Warning 配置</span>} help="同上格式">
            <Input placeholder="email:dev-team@longcheer.com" value={cfgWarning} onChange={e => setCfgWarning(e.target.value)} />
          </Form.Item>
          <Form.Item label="Info 配置" help="同上格式（可选）">
            <Input value={cfgInfo} onChange={e => setCfgInfo(e.target.value)} />
          </Form.Item>
          <Space><Button type="primary" htmlType="submit">保存</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>

      <Card title="全局默认接收人" size="small" style={{ marginTop: 16 }} extra={
        <Button type="link" icon={<PlusOutlined />} onClick={() => { setGlobalEditing(null); globalForm.resetFields(); setGlobalRecipientInput(''); setGlobalModal(true) }}>添加</Button>
      }>
        <Table
          rowKey="id" dataSource={globals} size="small" pagination={false}
          columns={[
            { title: '级别', dataIndex: 'severity', width: 80, align: 'center', render: (s: string) => <Tag color={s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'}>{s || '全部'}</Tag> },
            { title: '通道', dataIndex: 'channel', width: 70, align: 'center', render: (s: string) => <Tag>{s}</Tag> },
            { title: '接收人', dataIndex: 'recipients', render: (s: string) => {
              try { return JSON.parse(s).map((r: string, i: number) => <Tag key={i} style={{ margin: 2 }}>{r}</Tag>) }
              catch { return <span>{s}</span> }
            }},
            { title: '操作', width: 80, align: 'center', render: (_, r) => (
              <Space>
                <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} onClick={() => { setGlobalEditing(r); globalForm.setFieldsValue({ severity: r.severity, channel: r.channel }); setGlobalRecipientInput(JSON.parse(r.recipients || '[]').join(', ')); setGlobalModal(true) }} />
                <Popconfirm title="确认删除？" onConfirm={async () => { await api.delete(`/alerts/recipients/${r.id}`); setGlobals(globals.filter(g => g.id !== r.id)) }}>
                  <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
                </Popconfirm>
              </Space>
            )},
          ]}
          locale={{ emptyText: '暂无全局默认配置，策略未匹配时会尝试使用全局配置' }}
        />
      </Card>
      <Modal title={globalEditing ? '编辑全局默认' : '添加全局默认'} open={globalModal} onCancel={() => setGlobalModal(false)} footer={null} width={400}>
        <Form form={globalForm} layout="vertical" onFinish={async (values: any) => {
          const body = { ...values, recipients: globalRecipientInput.split(/[,;，；]+/).map((s: string) => s.trim()).filter(Boolean) }
          try {
            if (globalEditing) { await api.put(`/alerts/recipients/${globalEditing.id}`, body) }
            else { await api.post('/alerts/recipients', body) }
            setGlobalModal(false); const r = await api.get('/alerts/recipients'); setGlobals(r.data || [])
          } catch { message.error('保存失败') }
        }}>
          <Form.Item label="级别" name="severity"><Select options={[{ label: '严重 critical', value: 'critical' }, { label: '警告 warning', value: 'warning' }, { label: '信息 info', value: 'info' }, { label: '全部', value: '' }]} /></Form.Item>
          <Form.Item label="通道" name="channel" rules={[{ required: true }]}><Select options={[{ label: '邮件 email', value: 'email' }, { label: '飞书 lark', value: 'lark' }, { label: '电话 phone', value: 'phone' }]} /></Form.Item>
          <Form.Item label="接收人 (逗号分隔)"><Input.TextArea rows={2} value={globalRecipientInput} onChange={e => setGlobalRecipientInput(e.target.value)} /></Form.Item>
          <Space><Button type="primary" htmlType="submit">保存</Button><Button onClick={() => setGlobalModal(false)}>取消</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}
