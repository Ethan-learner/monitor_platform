import { useEffect, useState, useMemo } from 'react'
import { Button, Table, Tag, Space, Typography, Badge, Modal, Form, Input, Select, message, Popconfirm } from 'antd'
import { PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { fetchParsedRules, saveRuleFile, reloadPrometheus, type ParsedRule } from '../lib/rules'
import { api } from '../lib/api'

const { Title } = Typography
const CATEGORY_COLORS: Record<string, string> = { '应用告警': '#1677ff', '数据库告警': '#722ed1', '服务器告警': '#52c41a', '平台组件告警': '#fa8c16', '性能告警': '#eb2f96' }
const CATEGORY_PREFIX: Record<string, string> = { '应用告警': 'app_', '数据库告警': 'db_', '服务器告警': 'host_', '平台组件告警': 'component_', '性能告警': 'perf_' }

export default function NewRules() {
  const [rules, setRules] = useState<ParsedRule[]>([]); const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false); const [form] = Form.useForm(); const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ParsedRule | null>(null)
  const [editTarget, setEditTarget] = useState<ParsedRule | null>(null); const [editForm] = Form.useForm()
  const [deleteReason, setDeleteReason] = useState('')
  const [previewResult, setPreviewResult] = useState<string | null>(null); const [previewLoading, setPreviewLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = async () => { setLoading(true); try { setRules(await fetchParsedRules()) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])

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
      await saveRuleFile(fn, yaml); await reloadPrometheus(); message.success('创建成功'); setModalOpen(false); form.resetFields(); load()
    } catch { message.error('创建失败') } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.post('/rules/delete', { filename: deleteTarget.file, ruleName: deleteTarget.name, groupName: deleteTarget.group, reason: deleteReason, deletedBy: 'admin' })
      await reloadPrometheus(); message.success('规则已删除（移至 _disabled.yml）')
      setDeleteTarget(null); setDeleteReason(''); load()
    } catch (e: any) { message.error(e?.response?.data?.detail || '删除失败') }
  }

  const handleEdit = async (values: any) => {
    if (!editTarget) return
    try {
      await api.post('/rules/update', { filename: editTarget.file, groupName: editTarget.group, oldRuleName: editTarget.name, newName: values.name, expr: values.expr, for: values.for, severity: values.severity, summary: values.summary })
      await reloadPrometheus(); message.success('规则已更新'); setEditTarget(null); load()
    } catch (e: any) { message.error(e?.response?.data?.detail || '更新失败') }
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
          { title: '名称', dataIndex: 'name', width: 200 },
          { title: '表达式', dataIndex: 'expr', ellipsis: true, render: (e: string) => <code style={{ fontSize: 11 }}>{e}</code> },
          { title: '持续', dataIndex: 'for', width: 80 }, { title: '级别', dataIndex: 'severity', width: 70, render: (s: string) => <Tag color={s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'}>{s}</Tag> },
          { title: '文件', dataIndex: 'file', width: 220 }, { title: '描述', dataIndex: 'summary', ellipsis: true },
          { title: '操作', width: 120, render: (_, r) => (<Space>
            <Button size="small" type="text" icon={<EditOutlined style={{ color: '#999' }} />} onClick={() => { setEditTarget(r); editForm.setFieldsValue({ name: r.name, expr: r.expr, for: r.for, severity: r.severity, summary: r.summary }) }} />
            <Popconfirm title="确认删除该规则？" onConfirm={() => { setDeleteTarget(r); setDeleteReason('') }} okText="确认删除" cancelText="取消">
              <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#999' }} />} />
            </Popconfirm>
          </Space>)},
        ]}
      />
    </div>))}

    <Modal title="创建告警规则" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={600}>
      <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ category: '应用告警', severity: 'warning' }}>
        <Form.Item label="分类" name="category" rules={[{ required: true }]}><Select options={Object.keys(CATEGORY_PREFIX).map(c => ({ label: c, value: c }))} /></Form.Item>
        <Form.Item label="告警名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item label="表达式" name="expr" rules={[{ required: true }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <div style={{ marginBottom: 16 }}>
          <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handlePreview(form.getFieldValue('expr'))} loading={previewLoading}>预览</Button>
        </div>
        <Form.Item label="持续时间" name="for"><Input placeholder="1m" /></Form.Item>
        <Form.Item label="级别" name="severity"><Select options={[{ label: '警告 warning', value: 'warning' }, { label: '严重 critical', value: 'critical' }, { label: '信息 info', value: 'info' }]} /></Form.Item>
        <Form.Item label="描述" name="summary"><Input.TextArea rows={2} /></Form.Item>
        <Space><Button type="primary" htmlType="submit" loading={submitting}>创建</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
      </Form>
    </Modal>

    <Modal title="编辑告警规则" open={!!editTarget} onCancel={() => setEditTarget(null)} footer={null} width={600}>
      <Form form={editForm} layout="vertical" onFinish={handleEdit}>
        <Form.Item label="告警名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item label="表达式" name="expr" rules={[{ required: true }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <div style={{ marginBottom: 16 }}>
          <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handlePreview(editForm.getFieldValue('expr'))} loading={previewLoading}>预览</Button>
        </div>
        <Form.Item label="持续时间" name="for"><Input placeholder="1m" /></Form.Item>
        <Form.Item label="级别" name="severity"><Select options={[{ label: '警告 warning', value: 'warning' }, { label: '严重 critical', value: 'critical' }, { label: '信息 info', value: 'info' }]} /></Form.Item>
        <Form.Item label="描述" name="summary"><Input.TextArea rows={2} /></Form.Item>
        <Space><Button type="primary" htmlType="submit">保存</Button><Button onClick={() => setEditTarget(null)}>取消</Button></Space>
      </Form>
    </Modal>

    <Modal title="确认删除" open={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onOk={handleDelete} okText="确认删除" okButtonProps={{ danger: true }}>
      <p>规则: <strong>{deleteTarget?.name}</strong></p><p>文件: {deleteTarget?.file}</p>
      <Input.TextArea rows={2} placeholder="删除原因（可选）" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} style={{ marginTop: 8 }} />
    </Modal>
    <Modal title="查询预览" open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={700}>
      <pre style={{ fontSize: 12, maxHeight: 400, overflow: 'auto', background: '#f6f8fa', padding: 12, borderRadius: 4 }}>{previewResult}</pre>
    </Modal>
  </div>)
}
