import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, DatePicker, Select, message, Popconfirm } from 'antd'
import { ReloadOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { fetchSilences, expireSilence, createSilence, type Silence } from '../lib/rules'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function SilenceList() {
  const [silences, setSilences] = useState<Silence[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [filterCreator, setFilterCreator] = useState('')
  const [filterState, setFilterState] = useState('')

  const load = async () => {
    setLoading(true)
    try { setSilences(await fetchSilences()) }
    catch { message.error('Alertmanager 不可达') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleExpire = async (id: string) => {
    try { await expireSilence(id); message.success('已过期'); load() }
    catch { message.error('过期失败') }
  }

  const handleCreate = async (values: any) => {
    setSubmitting(true)
    try {
      const [start, end] = values.timeRange || []
      await createSilence({
        matchers: [{ name: values.matcherName || 'alertname', value: values.matcherValue, isRegex: false }],
        startsAt: start?.toISOString() || new Date().toISOString(),
        endsAt: end?.toISOString() || new Date(Date.now() + 3600000).toISOString(),
        createdBy: values.createdBy || 'admin',
        comment: values.comment || '',
      })
      message.success('静默创建成功')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch { message.error('创建失败') } finally { setSubmitting(false) }
  }

  const creators = useMemo(() => [...new Set(silences.map(s => s.createdBy))], [silences])
  const filtered = useMemo(() => {
    let list = [...silences]
    if (filterCreator) list = list.filter(s => s.createdBy === filterCreator)
    if (filterState) list = list.filter(s => (s.status?.state || '') === filterState)
    return list
  }, [silences, filterCreator, filterState])

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>静默规则</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建静默</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>
      <Space style={{ marginBottom: 12 }}>
        <Space>
          <Select placeholder="创建人" allowClear style={{ width: 140 }} value={filterCreator || undefined} onChange={v => setFilterCreator(v || '')}
            options={creators.map(c => ({ label: c, value: c }))} />
          <Select placeholder="状态" allowClear style={{ width: 120 }} value={filterState || undefined} onChange={v => setFilterState(v || '')}
            options={[{ label: '活跃', value: 'active' }, { label: '已过期', value: 'expired' }]} />
        </Space>
      </Space>
      <Table<Silence>
        rowKey="id" dataSource={filtered} size="small" pagination={false}
        columns={[
          { title: '创建人', dataIndex: 'createdBy', width: 90 },
          { title: '匹配规则', width: 240, render: (_, r) => r.matchers?.map((m, i) => <Tag key={i} style={{ margin: 2 }}>{m.name}={m.value}</Tag>) },
          { title: '开始', dataIndex: 'startsAt', width: 150, render: (s: string) => new Date(s).toLocaleString() },
          { title: '结束', dataIndex: 'endsAt', width: 150, render: (s: string) => new Date(s).toLocaleString() },
          { title: '状态', dataIndex: ['status', 'state'], width: 70, render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
          { title: '备注', dataIndex: 'comment', ellipsis: true },
          { title: '操作', width: 60, render: (_, r) => r.status?.state === 'active' && (
            <Popconfirm title="确认过期该静默？" onConfirm={() => handleExpire(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )},
        ]}
      />
      <Modal title="新建静默" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ createdBy: 'admin', matcherName: 'alertname' }}>
          <Form.Item label="标签名" name="matcherName"><Input placeholder="alertname" /></Form.Item>
          <Form.Item label="匹配值" name="matcherValue" rules={[{ required: true, message: '必填' }]}><Input placeholder="InstanceDown" /></Form.Item>
          <Form.Item label="时间段" name="timeRange" rules={[{ required: true, message: '请选择时间' }]}>
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="创建人" name="createdBy"><Input /></Form.Item>
          <Form.Item label="备注" name="comment"><Input.TextArea rows={3} placeholder="维护窗口" /></Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={submitting}>创建</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}
