import { useEffect, useState } from 'react'
import { Table, Tag, Input, Space, Button, Typography, Select } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title } = Typography

export default function LoginLogs() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [result, setResult] = useState('')
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/settings/login-logs', { params: { limit: 20, offset: (page - 1) * 20, username, result } })
      setData(data.data || [])
      setTotal(data.total || 0)
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [page])

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>登录日志 ({total})</Title>
        <Space>
          <Input placeholder="搜索用户名" value={username} onChange={e => setUsername(e.target.value)} onPressEnter={() => { setPage(1); load() }} style={{ width: 160 }} />
          <Select placeholder="结果" allowClear style={{ width: 100 }} value={result || undefined} onChange={v => setResult(v || '')}
            options={[{ label: '成功', value: 'success' }, { label: '失败', value: 'failed' }]} />
          <Button icon={<SearchOutlined />} onClick={() => { setPage(1); load() }}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
        </Space>
      </Space>
      <Table
        rowKey="id"
        dataSource={data}
        loading={loading}
        size="middle"
        bordered
        pagination={{ current: page, pageSize: 20, total, showSizeChanger: false, onChange: setPage }}
        columns={[
          { title: '登录时间', dataIndex: 'loginTime', width: 160, align: 'center', render: (s: string) => s ? new Date(s).toLocaleString() : '—' },
          { title: '用户名', dataIndex: 'username', width: 120, align: 'center' },
          { title: '姓名', dataIndex: 'displayName', width: 100, align: 'center' },
          { title: '工号', dataIndex: 'personCode', width: 100, align: 'center' },
          { title: '部门', dataIndex: 'department', ellipsis: true, align: 'center' },
          { title: 'IP', dataIndex: 'ip', width: 130, align: 'center' },
          { title: '结果', dataIndex: 'result', width: 70, align: 'center', render: (s: string) => (
            <Tag color={s === 'success' ? 'green' : 'red'}>{s === 'success' ? '成功' : '失败'}</Tag>
          )},
          { title: '失败原因', dataIndex: 'failedReason', ellipsis: true, align: 'center' },
        ]}
      />
    </div>
  )
}
