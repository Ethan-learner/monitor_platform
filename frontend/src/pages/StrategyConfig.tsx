import { useEffect, useState } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, Select, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons'
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

  const load = async () => { setLoading(true); try { setData((await api.get('/alerts/strategies')).data) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])

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
        rowKey="id" dataSource={data.filter(d => d.enabled !== -1)} size="middle" pagination={false} bordered
        columns={[
          { title: '名称', dataIndex: 'label', width: 150, render: (s: string, r) => <span><strong>{s || r.name}</strong></span> },
          { title: '标识', dataIndex: 'name', width: 130, render: (s: string) => <code>{s}</code> },
          { title: '说明', dataIndex: 'description', ellipsis: true },
          { title: 'critical', width: 160, render: (_, r) => <span style={{ fontSize: 12, color: r.config?.critical?.email?.length ? '#cf1322' : '#999' }}>{getCfgStr(r.config, 'critical') || '—'}</span> },
          { title: 'warning', width: 160, render: (_, r) => <span style={{ fontSize: 12, color: r.config?.warning?.email?.length ? '#d48806' : '#999' }}>{getCfgStr(r.config, 'warning') || '—'}</span> },
          { title: '状态', width: 70, align: 'center', render: (_, r) => {
            if (r.enabled === 1) return <Tag color="green">启用</Tag>
            if (r.enabled === 0) return <Tag color="orange">禁用</Tag>
            return <Tag color="red">已删除</Tag>
          }},
          { title: '操作', width: 140, align: 'center', render: (_, r) => (
            <Space>
              <Button size="small" type="text" onClick={async () => {
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

      <Modal title={editing ? '编辑策略' : '新增策略'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={600}>
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
    </div>
  )
}
