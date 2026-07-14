import { useEffect, useState } from 'react'
import { Table, Tag, Typography, Button, Space, Input, Select, Row, Col } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../lib/api'
import { cacheGet, cacheSet } from '../lib/cache'

const { Title } = Typography

interface HistoryAlert {
  alertName: string
  alertTime: string
  instance: string
  severity: string
  department: string
  project: string
  env: string
  service: string
  status: string
  summary: string
}

interface Filters {
  alertName: string
  instance: string
  status: '' | 'firing' | 'resolved'
  severity: string
}

export default function AlertHistory() {
  const [data, setData] = useState<HistoryAlert[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<Filters>({ alertName: '', instance: '', status: '', severity: '' })

  const load = async (currentPage = page, currentSize = pageSize, currentFilters = filters) => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        limit: currentSize,
        offset: (currentPage - 1) * currentSize,
      }
      if (currentFilters.alertName) params.alertname = currentFilters.alertName
      if (currentFilters.instance) params.instance = currentFilters.instance
      if (currentFilters.status) params.status = currentFilters.status
      if (currentFilters.severity) params.severity = currentFilters.severity

      const { data: d } = await api.get('/alerts/records', { params })
      setData(d.data)
      setTotal(d.total)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load(1, pageSize, filters) }, [])

  const handleTextFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleStatusChange = (value: string) => {
    const next = { ...filters, status: value as Filters['status'] }
    setFilters(next)
    setPage(1)
    load(1, pageSize, next)
  }

  const handleSearch = () => {
    setPage(1)
    load(1, pageSize, filters)
  }

  const handlePageChange = (p: number, size: number) => {
    setPage(p)
    setPageSize(size)
    load(p, size, filters)
  }

  const handleShowSizeChange = (_: number, size: number) => {
    setPage(1)
    setPageSize(size)
    load(1, size, filters)
  }

  const sevColor: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' }

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 12 }}>
        <Col flex="auto">
          <Title level={5} style={{ margin: 0 }}>历史告警 ({total})</Title>
        </Col>
        <Col>
          <Space wrap>
            <Input
              placeholder="告警名称"
              value={filters.alertName}
              onChange={(e) => handleTextFilterChange('alertName', e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              style={{ width: 160 }}
            />
            <Input
              placeholder="实例"
              value={filters.instance}
              onChange={(e) => handleTextFilterChange('instance', e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              style={{ width: 180 }}
            />
            <Select
              placeholder="状态"
              value={filters.status || undefined}
              onChange={handleStatusChange}
              allowClear
              options={[
                { label: '触发中', value: 'firing' },
                { label: '已恢复', value: 'resolved' },
              ]}
              style={{ width: 100 }}
            />
            <Input
              placeholder="级别"
              value={filters.severity}
              onChange={(e) => handleTextFilterChange('severity', e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              style={{ width: 100 }}
            />
            <Button type="primary" onClick={handleSearch}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>刷新</Button>
          </Space>
        </Col>
      </Row>
      <Table<HistoryAlert>
        rowKey={(r, i) => r.alertName + r.alertTime + i}
        dataSource={data} size="middle" bordered
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          pageSizeOptions: [20, 50, 100],
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: handlePageChange,
          onShowSizeChange: handleShowSizeChange,
        }}
        columns={[
          { title: '告警名称', dataIndex: 'alertName', width: 160, ellipsis: true, align: 'center' },
          { title: '级别', dataIndex: 'severity', width: 70, align: 'center', render: (s: string) => <Tag color={sevColor[s] || 'default'}>{s}</Tag> },
          { title: '实例', dataIndex: 'instance', width: 200, ellipsis: true, align: 'center' },
          { title: '开始时间', dataIndex: 'startsAt', width: 150, align: 'center', render: (s: string) => s ? new Date(s).toLocaleString() : '-' },
          { title: '结束时间', dataIndex: 'endsAt', width: 150, align: 'center', render: (s: string) => s ? new Date(s).toLocaleString() : '-' },
          { title: '状态', dataIndex: 'status', width: 70, align: 'center', render: (s: string) => <Tag color={s === 'firing' ? 'red' : 'green'}>{s || '-'}</Tag> },
          { title: '部门', dataIndex: 'department', width: 90, ellipsis: true, align: 'center' },
          { title: '项目', dataIndex: 'project', width: 80, ellipsis: true, align: 'center' },
          { title: '环境', dataIndex: 'env', width: 60, align: 'center' },
          { title: '服务', dataIndex: 'service', width: 120, ellipsis: true, align: 'center' },
          { title: '描述', dataIndex: 'summary', ellipsis: true, width: 100, align: 'center' },
        ]}
      />
    </div>
  )
}
