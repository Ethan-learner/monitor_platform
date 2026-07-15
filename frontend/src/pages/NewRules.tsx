import { useEffect, useState, useMemo } from 'react'
import { Button, Table, Tag, Space, Typography, Badge, Modal, Form, Input, Select, message, Popconfirm } from 'antd'
import { PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import { fetchParsedRules, saveRuleFile, reloadPrometheus, type ParsedRule } from '../lib/rules'
import { api } from '../lib/api'
import { cacheGet, cacheSet } from '../lib/cache'

const { Title } = Typography
const CATEGORY_COLORS: Record<string, string> = { '应用告警': '#1677ff', '数据库告警': '#722ed1', '服务器告警': '#52c41a', '平台组件告警': '#fa8c16', '性能告警': '#eb2f96' }
const CATEGORY_PREFIX: Record<string, string> = { '应用告警': 'app_', '数据库告警': 'db_', '服务器告警': 'host_', '平台组件告警': 'component_', '性能告警': 'perf_' }
const SEV_COLORS: Record<string, string> = { critical: '#cf1322', warning: '#d48806', info: '#1677ff' }
const SEV_LABELS: Record<string, string> = { critical: '严重', warning: '警告', info: '信息' }
const FORM_ITEM_STYLE = { marginBottom: 10 }

export default function NewRules() {
  const [rules, setRules] = useState<ParsedRule[]>([]); const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false); const [form] = Form.useForm(); const [submitting, setSubmitting] = useState(false)
  const [editTarget, setEditTarget] = useState<ParsedRule | null>(null); const [editForm] = Form.useForm()
  const [previewResult, setPreviewResult] = useState<string | null>(null); const [previewLoading, setPreviewLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [strategies, setStrategies] = useState<any[]>([])
  const [noStrategyModal, setNoStrategyModal] = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const [editCustomMode, setEditCustomMode] = useState(false)

  const load = async () => { setLoading(true); try { const cached = cacheGet('rules:parsed'); if (cached) setRules(cached); const data = await fetchParsedRules(); setRules(data); cacheSet('rules:parsed', data) } catch {} finally { setLoading(false) } }
  useEffect(() => { load(); api.get('/alerts/strategies').then(r => setStrategies(r.data || [])).catch(() => {}) }, [])

  const grouped = useMemo(() => { const m: Record<string, ParsedRule[]> = {}; rules.forEach(r => { (m[r.category] = m[r.category] || []).push(r) }); return m }, [rules])

  const handlePreview = async (expr: string) => {
    if (!expr) { message.warning('请先输入表达式'); return }
    setPreviewLoading(true)
    try {
      const { data } = await api.get('/rules/preview', { params: { query: expr } })
      const result = data?.data?.result
      setPreviewResult(!result || result.length === 0 ? '无数据' : JSON.stringify(result.slice(0, 5), null, 2))
      setPreviewOpen(true)
    } catch { setPreviewResult('查询失败'); setPreviewOpen(true) } finally { setPreviewLoading(false) }
  }

  const handleCreate = async (values: any) => {
    setSubmitting(true)
    try {
      const prefix = CATEGORY_PREFIX[values.category] || 'other_'
      const fn = `${prefix}${values.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.yml`
      const yaml = `groups:\n  - name: ${fn.replace('.yml', '')}\n    rules:\n      - alert: ${values.name}\n        expr: ${values.expr}\n        for: ${values.for || ''}\n        labels:\n          severity: ${values.severity || 'warning'}\n        annotations:\n          summary: "${values.summary || values.name}"\n`
      await saveRuleFile(fn, yaml, { category: values.category, operator: 'admin', strategy_id: values.strategy_id === '__custom__' ? null : values.strategy_id, custom_notify: values.custom_notify || '' }); await reloadPrometheus(); message.success('创建成功'); setModalOpen(false); form.resetFields(); setCustomMode(false); load()
    } catch { message.error('创建失败') } finally { setSubmitting(false) }
  }

  const handleDelete = async (ruleName: string) => {
    try {
      await api.post('/rules/delete', { ruleName })
      await reloadPrometheus(); message.success('规则已删除'); load()
    } catch (e: any) { message.error(e?.response?.data?.detail || '删除失败') }
  }

  const handleEdit = async (values: any) => {
    if (!editTarget) return
    try {
      await api.post('/rules/update', { filename: editTarget.file, groupName: editTarget.group, oldRuleName: editTarget.name, newName: values.name, expr: values.expr, for: values.for, severity: values.severity, summary: values.summary, strategy_id: values.strategy_id === '__custom__' ? null : values.strategy_id, custom_notify: values.custom_notify || '' })
      await reloadPrometheus(); message.success('规则已更新'); setEditTarget(null); setEditCustomMode(false); load()
    } catch (e: any) { message.error(e?.response?.data?.detail || '更新失败') }
  }

  const getStrategyName = (sid: string | number) => {
    if (!sid) return '-'
    const s = strategies.find((x: any) => String(x.id) === String(sid))
    return s ? (s.label || s.name) : '-'
  }

  return (<div style={{ padding: 16 }}>
    <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
      <Title level={5} style={{ margin: 0 }}>告警规则 ({rules.length})</Title>
      <Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建规则</Button><Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button></Space>
    </Space>
    {Object.entries(grouped).map(([cat, items]) => (<div key={cat} style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: 8 }}><Badge color={CATEGORY_COLORS[cat] || '#d9d9d9'} /><strong>{cat}</strong><Tag>{items.length}</Tag></Space>
      <Table<ParsedRule> rowKey={(r, i) => r.name + i} dataSource={items} size="middle" pagination={false} bordered
        columns={[
          { title: '名称', dataIndex: 'name', width: 180, align: 'center' },
          { title: '表达式', dataIndex: 'expr', ellipsis: true, align: 'center', render: (e: string) => <code style={{ fontSize: 11 }}>{e}</code> },
          { title: '持续', dataIndex: 'for', width: 60, align: 'center' },
          { title: '策略', width: 120, align: 'center', render: (_: any, r: any) => <span style={{ fontSize: 12 }}>{getStrategyName(r.strategy_id)}</span> },
          { title: '告警级别', width: 70, align: 'center', render: (_: any, r: any) => (
            <Tag color={SEV_COLORS[r.severity] || '#999'}>{SEV_LABELS[r.severity] || r.severity || '—'}</Tag>
          )},
          { title: '描述', dataIndex: 'summary', ellipsis: true, align: 'center' },
          { title: '状态', width: 70, align: 'center', render: (_: any, r: any) => (
            <Tag color={r.status === 0 ? 'orange' : 'green'}>{r.status === 0 ? '禁用' : '启用'}</Tag>
          )},
          { title: '操作', width: 130, align: 'center', render: (_: any, r: any) => (<Space>
            <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} onClick={() => {
              setEditTarget(r)
              setEditCustomMode(!r.strategy_id && !!r.custom_notify)
              editForm.setFieldsValue({ name: r.name, expr: r.expr, for: r.for, severity: r.severity, summary: r.summary, strategy_id: r.strategy_id || '__custom__', custom_notify: r.custom_notify })
            }} />
            <Button size="small" type="text" onClick={async () => {
              if (r.status !== 0) { api.post('/rules/disable', { ruleName: r.name }).then(load); return }
              if (r.strategy_id) {
                try { await api.get(`/alerts/strategies/${r.strategy_id}`); api.post('/rules/disable', { ruleName: r.name }).then(load) }
                catch { setNoStrategyModal(true) }
              } else { api.post('/rules/disable', { ruleName: r.name }).then(load) }
            }}>
              <StopOutlined style={{ color: r.status === 0 ? '#ddd' : '#fa8c16' }} />
            </Button>
            <Popconfirm title="确认删除该规则？" onConfirm={() => handleDelete(r.name)} okText="确认删除" cancelText="取消">
              <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
            </Popconfirm>
          </Space>)},
        ]}
      />
    </div>))}

    <Modal title="创建告警规则" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={600}>
      <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ category: '应用告警', severity: 'warning' }}>
        <Form.Item label="分类" name="category" rules={[{ required: true }]} style={FORM_ITEM_STYLE}>
          <Select options={Object.keys(CATEGORY_PREFIX).map(c => ({ label: c, value: c }))} />
        </Form.Item>
        <Form.Item label="告警名称" name="name" rules={[{ required: true }]} style={FORM_ITEM_STYLE}><Input /></Form.Item>
        <Form.Item label="表达式" name="expr" rules={[{ required: true }]} style={FORM_ITEM_STYLE}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <div style={{ marginBottom: 12 }}>
          <Button size="small" onClick={() => handlePreview(form.getFieldValue('expr'))} loading={previewLoading}>预览</Button>
        </div>
        <Form.Item label="持续时间" name="for" style={FORM_ITEM_STYLE}><Input placeholder="1m" /></Form.Item>
        <Form.Item label="通知策略" name="strategy_id" style={FORM_ITEM_STYLE}>
          <Select allowClear placeholder="选策略模板（可选）"
            options={[...strategies.filter((s: any) => s.enabled === 1).map((s: any) => ({ label: s.label || s.name, value: s.id })), { label: '自定义', value: '__custom__' }]}
            onChange={(val) => {
              setCustomMode(val === '__custom__')
              if (val && val !== '__custom__') {
                const s = strategies.find((x: any) => x.id === val)
                if (s?.config) {
                  const levels = (['critical', 'warning', 'info'] as const).filter(k => s.config[k] && Object.keys(s.config[k]).length > 0)
                  form.setFieldsValue({ severity: levels[0] || 'warning', custom_notify: undefined })
                }
              }
              if (val === '__custom__') { form.setFieldsValue({ severity: 'warning' }) }
            }} />
        </Form.Item>
        {customMode && (
          <Form.Item label="自定义接收人" name="custom_notify" style={FORM_ITEM_STYLE}>
            <Input placeholder="critical:email:a@x.com,lark:id1; warning:email:b@x.com" />
          </Form.Item>
        )}
        <Form.Item label="级别" name="severity" style={FORM_ITEM_STYLE}>
          <Select options={[{ label: '警告 warning', value: 'warning' }, { label: '严重 critical', value: 'critical' }, { label: '信息 info', value: 'info' }]} />
        </Form.Item>
        <Form.Item label="描述" name="summary" style={FORM_ITEM_STYLE}><Input.TextArea rows={2} /></Form.Item>
        <Space><Button type="primary" htmlType="submit" loading={submitting}>创建</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
      </Form>
    </Modal>

    <Modal title="编辑告警规则" open={!!editTarget} onCancel={() => setEditTarget(null)} footer={null} width={600}>
      <Form form={editForm} layout="vertical" onFinish={handleEdit}>
        <Form.Item label="告警名称" name="name" rules={[{ required: true }]} style={FORM_ITEM_STYLE}><Input /></Form.Item>
        <Form.Item label="表达式" name="expr" rules={[{ required: true }]} style={FORM_ITEM_STYLE}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <div style={{ marginBottom: 12 }}>
          <Button size="small" onClick={() => handlePreview(editForm.getFieldValue('expr'))} loading={previewLoading}>预览</Button>
        </div>
        <Form.Item label="持续时间" name="for" style={FORM_ITEM_STYLE}><Input placeholder="1m" /></Form.Item>
        <Form.Item label="通知策略" name="strategy_id" style={FORM_ITEM_STYLE}>
          <Select allowClear placeholder="选策略模板（可选）"
            options={[...strategies.filter((s: any) => s.enabled === 1).map((s: any) => ({ label: s.label || s.name, value: s.id })), { label: '自定义', value: '__custom__' }]}
            onChange={(val) => {
              setEditCustomMode(val === '__custom__')
              if (val && val !== '__custom__') {
                const se = strategies.find((x: any) => x.id === val)
                if (se?.config) {
                  const levels = (['critical', 'warning', 'info'] as const).filter(k => se.config[k] && Object.keys(se.config[k]).length > 0)
                  editForm.setFieldsValue({ severity: levels[0] || 'warning', custom_notify: undefined })
                }
              }
              if (val === '__custom__') { editForm.setFieldsValue({ severity: 'warning' }) }
            }} />
        </Form.Item>
        {editCustomMode && (
          <Form.Item label="自定义接收人" name="custom_notify" style={FORM_ITEM_STYLE}>
            <Input placeholder="critical:email:a@x.com,lark:id1; warning:email:b@x.com" />
          </Form.Item>
        )}
        <Form.Item label="级别" name="severity" style={FORM_ITEM_STYLE}>
          <Select options={[{ label: '警告 warning', value: 'warning' }, { label: '严重 critical', value: 'critical' }, { label: '信息 info', value: 'info' }]} />
        </Form.Item>
        <Form.Item label="描述" name="summary" style={FORM_ITEM_STYLE}><Input.TextArea rows={2} /></Form.Item>
        <Space><Button type="primary" htmlType="submit">保存</Button><Button onClick={() => setEditTarget(null)}>取消</Button></Space>
      </Form>
    </Modal>

    <Modal title="查询预览" open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={700}>
      <pre style={{ fontSize: 12, maxHeight: 400, overflow: 'auto', background: '#f6f8fa', padding: 12, borderRadius: 4 }}>{previewResult}</pre>
    </Modal>
    <Modal title="无法启用" open={noStrategyModal} onCancel={() => setNoStrategyModal(false)} footer={null}>
      <p>引用的策略不存在，请先修改规则的策略配置。</p>
    </Modal>
  </div>)
}
