import { useEffect, useState } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Select, Input, Popconfirm, message, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

interface Recipient { id: number; ruleName: string; severity: string; channel: string; recipients: string; enabled: number }

export default function RecipientConfig() {
  const [data, setData] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Recipient | null>(null)
  const [form] = Form.useForm()
  const [recipientInput, setRecipientInput] = useState('')

  const load = async () => { setLoading(true); try { setData((await api.get('/alerts/recipients')).data) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const handleSave = async (values: any) => {
    const body = { ...values, recipients: recipientInput.split(/[,;，；]+/).map((s: string) => s.trim()).filter(Boolean) }
    try {
      if (editing) { await api.put(`/alerts/recipients/${editing.id}`, body); message.success('已更新') }
      else { await api.post('/alerts/recipients', body); message.success('已创建') }
      setModalOpen(false); form.resetFields(); setRecipientInput(''); setEditing(null); load()
    } catch { message.error('保存失败') }
  }

  const handleDelete = async (id: number) => { try { await api.delete(`/alerts/recipients/${id}`); message.success('已禁用'); load() } catch { message.error('操作失败') } }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Title level={5} style={{ margin: 0 }}>接收人配置</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setRecipientInput(''); setModalOpen(true) }}>新增规则</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>

      <Table<Recipient>
        rowKey="id" dataSource={data} size="middle" pagination={false} bordered
        columns={[
          { title: '级别', dataIndex: 'severity', width: 80, align: 'center', render: (s: string) => <Tag color={s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'}>{s || '全部'}</Tag> },
          { title: '通道', dataIndex: 'channel', width: 80, align: 'center', render: (s: string) => <Tag>{s}</Tag> },
          { title: '接收人', dataIndex: 'recipients', render: (s: string) => {
            try { return JSON.parse(s).map((r: string, i: number) => <Tag key={i} style={{ margin: 2 }}>{r}</Tag>) }
            catch { return <span>{s}</span> }
          }},
          { title: '状态', width: 70, align: 'center', render: (_, r) => <Tag color={r.enabled ? 'green' : 'red'}>{r.enabled ? '启用' : '禁用'}</Tag> },
          { title: '操作', width: 120, align: 'center', render: (_, r) => (
            <Space>
              <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} onClick={() => { setEditing(r); form.setFieldsValue({ severity: r.severity, channel: r.channel, ruleName: r.ruleName }); setRecipientInput(JSON.parse(r.recipients || '[]').join(', ')); setModalOpen(true) }} />
              <Popconfirm title="确认禁用该规则？" onConfirm={() => handleDelete(r.id)}>
                <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
              </Popconfirm>
            </Space>
          )},
        ]}
      />

      <Modal title={editing ? '编辑规则' : '新增规则'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ severity: 'warning', channel: 'email' }}>
          <Form.Item label="级别" name="severity">
            <Select options={[{ label: '严重 critical', value: 'critical' }, { label: '警告 warning', value: 'warning' }, { label: '信息 info', value: 'info' }, { label: '全部', value: '' }]} />
          </Form.Item>
          <Form.Item label="通道" name="channel" rules={[{ required: true }]}>
            <Select options={[{ label: '邮件 email', value: 'email' }, { label: '飞书 lark', value: 'lark' }, { label: '电话 phone', value: 'phone' }]} />
          </Form.Item>
          <Form.Item label="接收人 (逗号/分号分隔)">
            <Input.TextArea rows={3} placeholder="zhulei1@longcheer.com, user2@longcheer.com" value={recipientInput} onChange={e => setRecipientInput(e.target.value)} />
          </Form.Item>
          <Space><Button type="primary" htmlType="submit">保存</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}
