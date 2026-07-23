import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, Form, Input, DatePicker, Select, message, Popconfirm } from 'antd'
import { ReloadOutlined, DeleteOutlined, PlusOutlined, StopOutlined, UndoOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchSilences, expireSilence, createSilence, type Silence } from '../lib/rules'
import { api } from '../lib/api'
import { cacheGet, cacheSet } from '../lib/cache'

const { Title } = Typography
const { RangePicker } = DatePicker

interface Matcher { name: string; value: string; isRegex: boolean }

const emptyMatcher = (): Matcher => ({ name: 'alertname', value: '', isRegex: false })

export default function SilenceList() {
  const [silences, setSilences] = useState<Silence[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<Silence | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [matchers, setMatchers] = useState<Matcher[]>([emptyMatcher()])
  const [filterCreator, setFilterCreator] = useState('')
  const [filterState, setFilterState] = useState('')

  const load = async () => {
    setLoading(true)
    try { const cached = cacheGet('rules:silences'); if (cached) setSilences(cached); const data = await fetchSilences(); setSilences(data); cacheSet('rules:silences', data) }
    catch { message.error('Alertmanager 不可达') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const isExpired = (r: Silence) => r.db_status === 0

  const handleExpire = async (id: string) => {
    try { await expireSilence(id); message.success('已过期'); load() }
    catch { message.error('操作失败') }
  }

  const handleReset = async (values: any) => {
    const [start, end] = values.timeRange || []
    if (!end || end.isBefore(dayjs())) { message.warning('结束时间不能小于当前时间'); return }
    setSubmitting(true)
    try {
      if (resetTarget?.id) await expireSilence(resetTarget.id)
      await createSilence({
        matchers: matchers.filter(m => m.name && m.value),
        startsAt: start?.format('YYYY-MM-DD HH:mm:ss') || dayjs().format('YYYY-MM-DD HH:mm:ss'),
        endsAt: end.format('YYYY-MM-DD HH:mm:ss'),
        createdBy: values.createdBy || 'admin',
        comment: values.comment || '',
      })
      message.success('已重置'); closeModal(); load()
    } catch { message.error('重置失败') } finally { setSubmitting(false) }
  }

  const handleCreate = async (values: any) => {
    const [start, end] = values.timeRange || []
    if (!end || end.isBefore(dayjs())) { message.warning('结束时间不能小于当前时间'); return }
    setSubmitting(true)
    try {
      await createSilence({
        matchers: matchers.filter(m => m.name && m.value),
        startsAt: start?.format('YYYY-MM-DD HH:mm:ss') || dayjs().format('YYYY-MM-DD HH:mm:ss'),
        endsAt: end.format('YYYY-MM-DD HH:mm:ss'),
        createdBy: values.createdBy || 'admin',
        comment: values.comment || '',
      })
      message.success('静默创建成功'); closeModal(); load()
    } catch { message.error('创建失败') } finally { setSubmitting(false) }
  }

  const closeModal = () => { setModalOpen(false); setResetTarget(null); form.resetFields(); setMatchers([emptyMatcher()]) }
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
    setMatchers(r.matchers?.length ? r.matchers : [{ name: 'alertname', value: '', isRegex: false }])
    form.setFieldsValue({
      timeRange: [dayjs().add(1, 'minute'), dayjs().add(61, 'minute')],
      createdBy: r.createdBy, comment: r.comment || '',
    })
  }

  const matcherForm = (
    <>
      {matchers.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <Select value={m.name} onChange={v => setMatchers(prev => prev.map((x, j) => j === i ? { ...x, name: v } : x))}
            style={{ width: 150 }} options={['alertname', 'instance', 'job', 'severity', 'service', 'env'].map(s => ({ label: s, value: s }))} />
          <Select value={m.isRegex ? '=~' : '='} onChange={v => setMatchers(prev => prev.map((x, j) => j === i ? { ...x, isRegex: v === '=~' } : x))}
            style={{ width: 60 }}>
            <Select.Option value="=">=</Select.Option>
            <Select.Option value="=~">=~</Select.Option>
          </Select>
          <Input value={m.value} onChange={e => setMatchers(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
            placeholder="匹配值" style={{ flex: 1 }} />
          {matchers.length > 1 && <Button type="text" size="small" icon={<MinusCircleOutlined />} onClick={() => setMatchers(prev => prev.filter((_, j) => j !== i))} danger />}
        </div>
      ))}
      <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setMatchers(prev => [...prev, emptyMatcher()])} block>添加条件</Button>
    </>
  )

  const createModal = (
    <Modal title="新建静默" open={modalOpen} onCancel={closeModal} footer={null}>
      <Form form={form} layout="vertical" onFinish={handleCreate}>
        <Form.Item label="匹配规则" required style={{ marginBottom: 12 }}>{matcherForm}</Form.Item>
        <Form.Item label="时间段" name="timeRange" rules={[{ required: true, message: '请选择时间' }, (_: any) => ({
          validator(_, value) { if (value && value[0] && value[1] && !value[1].isAfter(value[0])) return Promise.reject('结束时间必须大于开始时间'); return Promise.resolve() }
        })]}>
          <RangePicker showTime style={{ width: '100%' }} disabledDate={(d: any) => d && d.isBefore(dayjs().startOf('day'))} />
        </Form.Item>
        <Form.Item label="备注" name="comment"><Input.TextArea rows={3} /></Form.Item>
        <Space><Button type="primary" htmlType="submit" loading={submitting}>创建</Button><Button onClick={closeModal}>取消</Button></Space>
      </Form>
    </Modal>
  )

  const resetModal = (
    <Modal title="重置静默" open={!!resetTarget} onCancel={closeModal} footer={null}>
      <Form form={form} layout="vertical" onFinish={handleReset}>
        <Form.Item label="匹配规则" required style={{ marginBottom: 12 }}>{matcherForm}</Form.Item>
        <Form.Item label="时间段" name="timeRange" rules={[{ required: true, message: '请选择时间' }, (_: any) => ({
          validator(_, value) { if (value && value[0] && value[1] && !value[1].isAfter(value[0])) return Promise.reject('结束时间必须大于开始时间'); return Promise.resolve() }
        })]}>
          <RangePicker showTime style={{ width: '100%' }} disabledDate={(d: any) => d && d.isBefore(dayjs().startOf('day'))} />
        </Form.Item>
        <Form.Item label="备注" name="comment"><Input.TextArea rows={3} placeholder="" /></Form.Item>
        <Space><Button type="primary" htmlType="submit" loading={submitting}>保存</Button><Button onClick={closeModal}>取消</Button></Space>
      </Form>
    </Modal>
  )

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>静默规则 ({filtered.length})</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setMatchers([emptyMatcher()]); setModalOpen(true) }}>创建静默</Button>
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
          { title: '匹配规则', width: 280, align: 'center', render: (_, r) => {
            const ms = r.matchers
            if (ms?.length) return ms.map((m, i) => <Tag key={i} style={{ margin: 2 }}>{m.name}{m.isRegex ? '=~' : '='}{m.value}</Tag>)
            return <span style={{ color: '#999' }}>—</span>
          }},
          { title: '开始时间', dataIndex: 'startsAt', width: 160, align: 'center', render: (s: string) => new Date(s).toLocaleString() },
          { title: '结束时间', dataIndex: 'endsAt', width: 160, align: 'center', render: (s: string) => new Date(s).toLocaleString() },
          { title: '状态', width: 100, align: 'center', render: (_, r) => (
            isExpired(r) ? <Tag color="orange">已过期</Tag> : <Tag color="green">活跃</Tag>
          )},
          { title: '备注', width: 300, dataIndex: 'comment', ellipsis: true, align: 'center' },
          { title: '操作', width: 100, align: 'center', render: (_, r) => {
            const expired = isExpired(r)
            return (
              <Space>
                <Popconfirm title="确认过期该静默？" onConfirm={() => handleExpire(r.id)} okText="确认" cancelText="取消" disabled={expired}>
                  <Button size="small" type="text" icon={<StopOutlined style={{ color: expired ? '#ddd' : '#fa8c16' }} />} />
                </Popconfirm>
                <Button size="small" type="text" icon={<UndoOutlined style={{ color: expired ? '#1677ff' : '#ddd' }} />}
                  onClick={() => { if (expired) openReset(r) }} disabled={!expired} />
                <Popconfirm title="确认删除该静默？" onConfirm={() => { api.post(`/alerts/silences/${r.id}/delete`).then(() => { message.success('已删除'); load() }).catch(() => message.error('操作失败')) }} okText="确认删除" cancelText="取消"
                  onCancel={() => {}} disabled={!expired}>
                  <Button size="small" type="text" onClick={(e) => { if (!expired) { e.stopPropagation(); message.warning('请先过期静默规则，再执行删除操作') } }}
                    icon={<DeleteOutlined style={{ color: expired ? '#999' : '#ddd' }} />} />
                </Popconfirm>
              </Space>
            )
          }},
        ]}
      />
      {createModal}
      {resetModal}
    </div>
  )
}
