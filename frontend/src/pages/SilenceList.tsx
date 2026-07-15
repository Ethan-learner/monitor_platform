import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, DatePicker, Select, message, Popconfirm } from 'antd'
import { ReloadOutlined, PlusOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchSilences, expireSilence, createSilence, type Silence } from '../lib/rules'
import { cacheGet, cacheSet } from '../lib/cache'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function SilenceList() {
  const [silences, setSilences] = useState<Silence[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<Silence | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [filterCreator, setFilterCreator] = useState('')
  const [filterState, setFilterState] = useState('')

  const load = async () => {
    setLoading(true)
    try { const cached = cacheGet('rules:silences'); if (cached) setSilences(cached); const data = await fetchSilences(); setSilences(data); cacheSet('rules:silences', data) }
    catch { message.error('Alertmanager 不可达') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const isExpired = (r: Silence) => r.db_status === 0 || r.status?.state !== 'active'

  const handleExpire = async (id: string) => {
    try { await expireSilence(id); message.success('已过期'); load() }
    catch { message.error('操作失败') }
  }

  const handleReset = async (values: any) => {
    if (!resetTarget) return
    setSubmitting(true)
    try {
      const [start, end] = values.timeRange || []
      // expire old + create new
      await expireSilence(resetTarget.id)
      await createSilence({
        matchers: [{ name: values.matcherName || 'alertname', value: values.matcherValue, isRegex: false }],
        startsAt: start?.toISOString() || new Date().toISOString(),
        endsAt: end?.toISOString() || new Date(Date.now() + 3600000).toISOString(),
        createdBy: values.createdBy || 'admin',
        comment: values.comment || '',
      })
      message.success('已重置')
      setResetTarget(null); form.resetFields(); load()
    } catch { message.error('重置失败') } finally { setSubmitting(false) }
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
      message.success('静默创建成功'); setModalOpen(false); form.resetFields(); load()
    } catch { message.error('创建失败') } finally { setSubmitting(false) }
  }

  const creators = useMemo(() => [...new Set(silences.map(s => s.createdBy))], [silences])
  const filtered = useMemo(() => {
    let list = silences.filter(s => s.db_status !== -1)
    if (filterCreator) list = list.filter(s => s.createdBy === filterCreator)
    if (filterState === 'active') list = list.filter(s => !isExpired(s))
    if (filterState === 'expired') list = list.filter(s => isExpired(s))
    return list
  }, [silences, filterCreator, filterState])

  const openReset = (r: Silence) => {
    setResetTarget(r)
    const m = r.matchers?.[0] || {}
    form.setFieldsValue({
      matcherName: m.name || 'alertname', matcherValue: m.value || '',
      timeRange: [dayjs().add(1, 'minute'), dayjs().add(61, 'minute')],
      createdBy: r.createdBy, comment: r.comment || '',
    })
  }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>静默规则 ({filtered.length})</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true) }}>创建静默</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>
      <Space style={{ marginBottom: 12 }}>
        <Select placeholder="创建人" allowClear style={{ width: 140 }} value={filterCreator || undefined} onChange={v => setFilterCreator(v || '')}
          options={creators.map(c => ({ label: c, value: c }))} />
        <Select placeholder="状态" allowClear style={{ width: 120 }} value={filterState || undefined} onChange={v => setFilterState(v || '')}
          options={[{ label: '活跃', value: 'active' }, { label: '已过期', value: 'expired' }]} />
      </Space>
      <Table<Silence>
        rowKey="id" dataSource={filtered} pagination={false} bordered
        columns={[
          { title: '创建人', dataIndex: 'createdBy', width: 100, align: 'center' },
          { title: '匹配规则', width: 280, align: 'center', render: (_, r) => r.matchers?.map((m, i) => <Tag key={i} style={{ margin: 2 }}>{m.name}={m.value}</Tag>) },
          { title: '开始时间', dataIndex: 'startsAt', width: 160, align: 'center', render: (s: string) => new Date(s).toLocaleString() },
          { title: '结束时间', dataIndex: 'endsAt', width: 160, align: 'center', render: (s: string) => new Date(s).toLocaleString() },
          { title: '状态', width: 70, align: 'center', render: (_, r) => (
            isExpired(r) ? <Tag color="orange">已过期</Tag> : <Tag color="green">活跃</Tag>
          )},
          { title: '备注', dataIndex: 'comment', ellipsis: true, align: 'center' },
          { title: '操作', width: 120, align: 'center', render: (_, r) => {
            const expired = isExpired(r)
            return (
              <Space>
                <Popconfirm title="确认过期该静默？" onConfirm={() => handleExpire(r.id)} okText="确认" cancelText="取消" disabled={expired}>
                  <Button size="small" type="text" icon={<StopOutlined style={{ color: expired ? '#ddd' : '#fa8c16' }} />} />
                </Popconfirm>
                <Button size="small" type="text" icon={<UndoOutlined style={{ color: expired ? '#1677ff' : '#ddd' }} />}
                  onClick={() => { if (expired) openReset(r) }} disabled={!expired} />
              </Space>
            )
          }},
        ]}
      />
      <Modal title="新建静默" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ createdBy: 'admin', matcherName: 'alertname' }}>
          <Form.Item label="标签名" name="matcherName"><Input placeholder="alertname" /></Form.Item>
          <Form.Item label="匹配值" name="matcherValue" rules={[{ required: true, message: '必填' }]}><Input placeholder="InstanceDown" /></Form.Item>
          <Form.Item label="时间段" name="timeRange" rules={[{ required: true, message: '请选择时间' }, ({ getFieldValue }) => ({
            validator(_, value) {
              if (value && value[0] && value[1] && !value[1].isAfter(value[0])) return Promise.reject('结束时间必须大于开始时间')
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
      <Modal title="重置静默" open={!!resetTarget} onCancel={() => setResetTarget(null)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleReset} initialValues={{ createdBy: 'admin', matcherName: 'alertname' }}>
          <Form.Item label="标签名" name="matcherName"><Input placeholder="alertname" /></Form.Item>
          <Form.Item label="匹配值" name="matcherValue" rules={[{ required: true, message: '必填' }]}><Input placeholder="InstanceDown" /></Form.Item>
          <Form.Item label="时间段" name="timeRange" rules={[{ required: true, message: '请选择时间' }, ({ getFieldValue }) => ({
            validator(_, value) {
              if (value && value[0] && value[1] && !value[1].isAfter(value[0])) return Promise.reject('结束时间必须大于开始时间')
              return Promise.resolve()
            },
          })]}>
            <RangePicker showTime style={{ width: '100%' }} disabledDate={(d: any) => d && d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          <Form.Item label="创建人" name="createdBy"><Input /></Form.Item>
          <Form.Item label="备注" name="comment"><Input.TextArea rows={3} placeholder="" /></Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={submitting}>保存</Button><Button onClick={() => setResetTarget(null)}>取消</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}
