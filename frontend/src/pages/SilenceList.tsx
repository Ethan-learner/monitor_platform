import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, DatePicker, Select, message, Popconfirm } from 'antd'
import { ReloadOutlined, DeleteOutlined, PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchSilences, expireSilence, createSilence, type Silence } from '../lib/rules'
import { cacheGet, cacheSet } from '../lib/cache'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function SilenceList() {
  const [silences, setSilences] = useState<Silence[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [filterCreator, setFilterCreator] = useState('')

  const load = async () => {
    setLoading(true)
    try { const cached = cacheGet('rules:silences'); if (cached) setSilences(cached); const data = await fetchSilences(); setSilences(data); cacheSet('rules:silences', data) }
    catch { message.error('Alertmanager 不可达') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleExpire = async (id: string) => {
    try { await expireSilence(id); message.success('已过期'); load() }
    catch { message.error('操作失败') }
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

  const active = useMemo(() => {
    let list = silences.filter(s => s.status?.state === 'active')
    if (filterCreator) list = list.filter(s => s.createdBy === filterCreator)
    return list
  }, [silences, filterCreator])
  const creators = useMemo(() => [...new Set(silences.map(s => s.createdBy))], [silences])

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>静默规则 ({active.length})</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建静默</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>
      <Space style={{ marginBottom: 12 }}>
        <Select placeholder="创建人" allowClear style={{ width: 140 }} value={filterCreator || undefined} onChange={v => setFilterCreator(v || '')}
          options={creators.map(c => ({ label: c, value: c }))} />
      </Space>
      <Table<Silence>
        rowKey="id" dataSource={active} pagination={false} bordered
        columns={[
          { title: '创建人', dataIndex: 'createdBy', width: 100, align: 'center' },
          { title: '匹配规则', width: 280, align: 'center', render: (_, r) => r.matchers?.map((m, i) => <Tag key={i} style={{ margin: 2 }}>{m.name}={m.value}</Tag>) },
          { title: '开始时间', dataIndex: 'startsAt', width: 160, align: 'center', render: (s: string) => new Date(s).toLocaleString() },
          { title: '结束时间', dataIndex: 'endsAt', width: 160, align: 'center', render: (s: string) => new Date(s).toLocaleString() },
          { title: '状态', width: 70, align: 'center', render: () => <Tag color="green">活跃</Tag> },
          { title: '备注', dataIndex: 'comment', ellipsis: true, align: 'center' },
          { title: '操作', width: 160, align: 'center', render: (_, r) => (
            <Space>
              <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} disabled title="Alertmanager 暂不支持编辑" />
              <Popconfirm title="确认过期该静默？" onConfirm={() => handleExpire(r.id)} okText="确认" cancelText="取消">
                <Button size="small" type="text" icon={<StopOutlined style={{ color: '#fa8c16' }} />} />
              </Popconfirm>
              <Popconfirm title="确认删除该静默？" onConfirm={() => handleExpire(r.id)} okText="确认删除" cancelText="取消">
                <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
              </Popconfirm>
            </Space>
          )},
        ]}
      />
      <Modal title="新建静默" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ createdBy: 'admin', matcherName: 'alertname' }}>
          <Form.Item label="标签名" name="matcherName"><Input placeholder="alertname" /></Form.Item>
          <Form.Item label="匹配值" name="matcherValue" rules={[{ required: true, message: '必填' }]}><Input placeholder="InstanceDown" /></Form.Item>
          <Form.Item label="时间段" name="timeRange" rules={[{ required: true, message: '请选择时间' }, ({ getFieldValue }) => ({
            validator(_, value) {
              if (value && value[0] && value[1] && !value[1].isAfter(value[0])) {
                return Promise.reject('结束时间必须大于开始时间')
              }
              return Promise.resolve()
            },
          })]}>
            <RangePicker showTime style={{ width: '100%' }} disabledDate={(d: any) => d && d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          <Form.Item label="创建人" name="createdBy"><Input /></Form.Item>
          <Form.Item label="备注" name="comment"><Input.TextArea rows={3} placeholder="维护窗口" /></Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={submitting}>创建</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}
