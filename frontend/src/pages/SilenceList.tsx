import { useEffect, useState } from 'react'
import { Table, Button, Tag, Space, Typography, Modal, message, Popconfirm } from 'antd'
import { ReloadOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { fetchSilences, expireSilence, type Silence } from '../lib/rules'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography

export default function SilenceList() {
  const [silences, setSilences] = useState<Silence[]>([])
  const [loading, setLoading] = useState(false)
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

  const active = silences.filter(s => s.status?.state === 'active')
  const expired = silences.filter(s => s.status?.state !== 'active')

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>
          静默规则 {active.length > 0 && <Tag color="green">{active.length} 活跃</Tag>}
        </Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/dashboard/silence-new')}>新建静默</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>
      <Table<Silence>
        rowKey="id"
        dataSource={silences}
        size="small"
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 200, ellipsis: true },
          { title: '创建人', dataIndex: 'createdBy', width: 100 },
          { title: '匹配规则', width: 200, render: (_, r) =>
            r.matchers?.map((m, i) => <Tag key={i} style={{ margin: 2 }}>{m.name}={m.value}</Tag>)
          },
          { title: '开始', dataIndex: 'startsAt', width: 160, render: (s: string) => new Date(s).toLocaleString() },
          { title: '结束', dataIndex: 'endsAt', width: 160, render: (s: string) => new Date(s).toLocaleString() },
          { title: '状态', dataIndex: ['status', 'state'], width: 70, render: (s: string) =>
            <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag>
          },
          { title: '备注', dataIndex: 'comment', ellipsis: true },
          { title: '操作', width: 80, render: (_, r) => r.status?.state === 'active' && (
            <Popconfirm title="确认过期该静默？" onConfirm={() => handleExpire(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )},
        ]}
      />
    </div>
  )
}
