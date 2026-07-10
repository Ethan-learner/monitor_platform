import { useEffect, useState, useMemo } from 'react'
import { Button, Table, Tag, Space, Typography, Badge, Modal, Form, Input, Select, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { fetchParsedRules, saveRuleFile, reloadPrometheus, type ParsedRule } from '../lib/rules'

const { Title } = Typography
const CATEGORY_COLORS: Record<string, string> = {
  '应用告警': '#1677ff', '数据库告警': '#722ed1', '服务器告警': '#52c41a',
  '平台组件告警': '#fa8c16', '性能告警': '#eb2f96',
}
const CATEGORY_PREFIX: Record<string, string> = {
  '应用告警': 'app_', '数据库告警': 'db_', '服务器告警': 'host_',
  '平台组件告警': 'component_', '性能告警': 'perf_',
}

export default function NewRules() {
  const [rules, setRules] = useState<ParsedRule[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setRules(await fetchParsedRules()) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const map: Record<string, ParsedRule[]> = {}
    rules.forEach(r => { (map[r.category] = map[r.category] || []).push(r) })
    return map
  }, [rules])

  const handleCreate = async (values: any) => {
    setSubmitting(true)
    try {
      const prefix = CATEGORY_PREFIX[values.category] || 'other_'
      const sanitized = values.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
      const filename = `${prefix}${sanitized}.yml`
      const yaml = `groups:\n  - name: ${filename.replace('.yml', '')}\n    rules:\n      - alert: ${values.name}\n        expr: ${values.expr}\n        for: ${values.for || ''}\n        labels:\n          severity: ${values.severity || 'warning'}\n        annotations:\n          summary: "${values.summary || values.name}"\n`
      await saveRuleFile(filename, yaml)
      await reloadPrometheus()
      message.success('规则创建成功')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch { message.error('创建失败') } finally { setSubmitting(false) }
  }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>告警规则 ({rules.length})</Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建规则</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <Space style={{ marginBottom: 8 }}>
            <Badge color={CATEGORY_COLORS[cat] || '#d9d9d9'} />
            <strong>{cat}</strong>
            <Tag>{items.length}</Tag>
          </Space>
          <Table<ParsedRule>
            rowKey={(r, i) => r.name + i} dataSource={items} size="small" pagination={false}
            columns={[
              { title: '名称', dataIndex: 'name', width: 200 },
              { title: '表达式', dataIndex: 'expr', ellipsis: true, render: (e: string) => <code style={{ fontSize: 11 }}>{e}</code> },
              { title: '持续', dataIndex: 'for', width: 80 },
              { title: '级别', dataIndex: 'severity', width: 70, render: (s: string) => <Tag color={s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'}>{s}</Tag> },
              { title: '文件', dataIndex: 'file', width: 220 },
              { title: '描述', dataIndex: 'summary', ellipsis: true },
            ]}
          />
        </div>
      ))}
      <Modal title="创建告警规则" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ category: '应用告警', severity: 'warning' }}>
          <Form.Item label="分类" name="category" rules={[{ required: true }]}>
            <Select options={Object.keys(CATEGORY_PREFIX).map(c => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item label="告警名称" name="name" rules={[{ required: true, message: '必填' }]}><Input /></Form.Item>
          <Form.Item label="表达式(PromQL)" name="expr" rules={[{ required: true, message: '必填' }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item label="持续时间(如 1m)" name="for"><Input placeholder="1m" /></Form.Item>
          <Form.Item label="级别" name="severity">
            <Select options={[{ label: '警告 warning', value: 'warning' }, { label: '严重 critical', value: 'critical' }, { label: '信息 info', value: 'info' }]} />
          </Form.Item>
          <Form.Item label="描述" name="summary"><Input.TextArea rows={2} /></Form.Item>
          <Space><Button type="primary" htmlType="submit" loading={submitting}>创建</Button><Button onClick={() => setModalOpen(false)}>取消</Button></Space>
        </Form>
      </Modal>
    </div>
  )
}
