import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, message, Popconfirm, Select } from 'antd'
import { ReloadOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { fetchSilences, expireSilence, type Silence } from '../lib/rules'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

export default function SilenceList() {
  const [silences, setSilences] = useState<Silence[]>([])
  const [loading, setLoading] = useState(false)
  const [filterCreator, setFilterCreator] = useState<string>('')
  const [filterState, setFilterState] = useState<string>('')
  const navigate = useNavigate()

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
        <div />
      </Space>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Select placeholder="创建人" allowClear style={{ width: 140 }} value={filterCreator || undefined} onChange={v => setFilterCreator(v || '')}
            options={creators.map(c => ({ label: c, value: c }))} />
          <Select placeholder="状态" allowClear style={{ width: 120 }} value={filterState || undefined} onChange={v => setFilterState(v || '')}
            options={[{ label: '活跃', value: 'active' }, { label: '已过期', value: 'expired' }]} />
        </Space>
        <Space>          
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/dashboard/silence-new')}>新建静默</Button>
        </Space>
      </Space>
      <Table<Silence>
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={false}
        columns={[
          { title: '创建人', dataIndex: 'createdBy', width: 90 },
          { title: '匹配规则', width: 240, render: (_, r) =>
            r.matchers?.map((m, i) => <Tag key={i} style={{ margin: 2 }}>{m.name}={m.value}</Tag>)
          },
          { title: '开始', dataIndex: 'startsAt', width: 150, render: (s: string) => new Date(s).toLocaleString() },
          { title: '结束', dataIndex: 'endsAt', width: 150, render: (s: string) => new Date(s).toLocaleString() },
          { title: '状态', dataIndex: ['status', 'state'], width: 70, render: (s: string) =>
            <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag>
          },
          { title: '备注', dataIndex: 'comment', ellipsis: true },
          { title: '操作', width: 60, render: (_, r) => r.status?.state === 'active' && (
            <Popconfirm title="确认过期该静默？" onConfirm={() => handleExpire(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )},
        ]}
      />
    </div>
  )
}
