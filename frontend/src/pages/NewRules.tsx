import { useEffect, useState } from 'react'
import { Button, Table, Tag, Space, Typography, Modal, Input, message, Select, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import { fetchRuleFiles, saveRuleFile, reloadPrometheus, type RuleFile } from '../lib/rules'

const { TextArea } = Input
const { Title } = Typography

const CATEGORY_FILES: Record<string, string> = {
  '应用告警': 'app_',
  '数据库告警': 'db_',
  '服务器告警': 'host_',
  '平台组件告警': 'component_',
  '性能告警': 'perf_',
}

export default function NewRules() {
  const [files, setFiles] = useState<RuleFile[]>([])
  const [loading, setLoading] = useState(false)
  const [editFile, setEditFile] = useState<RuleFile | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [newCat, setNewCat] = useState('应用告警')
  const [newName, setNewName] = useState('')
  const [newExpr, setNewExpr] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setFiles(await fetchRuleFiles())
    } catch { message.warning('告警规则目录不可达，部署后配置 alerts_dir 即可使用') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleQuickNew = () => {
    if (!newName || !newExpr) { message.warning('请输入告警名称和表达式'); return }
    const prefix = CATEGORY_FILES[newCat] || 'other_'
    const fn = `${prefix}${newName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.yml`
    const yaml = `groups:\n  - name: ${fn.replace('.yml', '')}\n    rules:\n      - alert: ${newName}\n        expr: ${newExpr}\n        labels:\n          severity: warning\n        annotations:\n          summary: "${newName}"\n`
    setEditContent(yaml)
    setEditFile({ filename: fn, category: newCat, size: 0, mtime: Date.now(), content: yaml })
  }

  const handleSave = async () => {
    if (!editFile) return; setSaving(true)
    try { await saveRuleFile(editFile.filename, editContent); message.success('保存成功'); setEditFile(null); load() }
    catch { message.error('保存失败') } finally { setSaving(false) }
  }

  const handleReload = async () => {
    try { await reloadPrometheus(); message.success('Prometheus 已重载') } catch { message.error('重载失败') }
  }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>告警规则管理</Title>
        <Space>
          <Select value={newCat} onChange={setNewCat} size="small" style={{ width: 130 }}
            options={Object.keys(CATEGORY_FILES).map(c => ({ label: c, value: c }))} />
          <Input size="small" placeholder="告警名称" style={{ width: 140 }} value={newName} onChange={e => setNewName(e.target.value)} />
          <Input size="small" placeholder="表达式" style={{ width: 280 }} value={newExpr} onChange={e => setNewExpr(e.target.value)} />
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleQuickNew}>新增</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
          <Popconfirm title="确认重载 Prometheus 配置？" onConfirm={handleReload}>
            <Button size="small" type="primary">重载配置</Button>
          </Popconfirm>
        </Space>
      </Space>

      <Table<RuleFile>
        rowKey="filename"
        dataSource={files}
        size="small"
        pagination={false}
        columns={[
          { title: '文件名', dataIndex: 'filename', width: 280 },
          { title: '分类', dataIndex: 'category', width: 110, render: (c: string) => <Tag>{c}</Tag> },
          { title: '大小', dataIndex: 'size', width: 70, render: (s: number) => s < 1024 ? `${s}B` : `${(s/1024).toFixed(1)}KB` },
          { title: '操作', width: 80, render: (_: any, r: RuleFile) => (
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditFile(r); setEditContent(r.content) }}>编辑</Button>
          )},
        ]}
        expandable={{
          expandedRowRender: (r) => <pre style={{ fontSize: 12, maxHeight: 240, overflow: 'auto', background: '#f6f8fa', padding: 8, borderRadius: 4 }}>{r.content}</pre>,
        }}
      />

      <Modal title={`编辑 - ${editFile?.filename}`} open={!!editFile} onCancel={() => setEditFile(null)} width={800}
        footer={<Space><Button onClick={() => setEditFile(null)}>取消</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>保存</Button></Space>}>
        <TextArea rows={20} value={editContent} onChange={e => setEditContent(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
      </Modal>
    </div>
  )
}
