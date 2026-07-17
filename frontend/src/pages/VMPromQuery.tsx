import { useEffect, useState, useCallback } from 'react'
import { Input, Button, Space, Typography, Tag, Table, Card, message, Spin, Select } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title, Text } = Typography
const { TextArea } = Input

export default function VMPromQuery() {
  const [expr, setExpr] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'instant' | 'range'>('range')
  const [range, setRange] = useState('1h')
  const [history, setHistory] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')

  const loadHistory = useCallback(async () => {
    try { const r = await api.get('/vm/history', { params: { keyword, limit: 50 } }); setHistory(r.data || []) } catch {}
  }, [keyword])

  useEffect(() => { loadHistory() }, [loadHistory])

  const now = () => Math.floor(Date.now() / 1000)
  const parseDuration = (d: string) => {
    const m = d.match(/^(\d+)([mhd])$/)
    if (!m) return 3600
    const n = parseInt(m[1])
    if (m[2] === 'm') return n * 60
    if (m[2] === 'h') return n * 3600
    if (m[2] === 'd') return n * 86400
    return 3600
  }

  const execute = async (q?: string) => {
    const query = q || expr
    if (!query.trim()) { message.warning('请输入 PromQL'); return }
    setLoading(true); setError('')
    try {
      const duration = parseDuration(range)
      const start = now() - duration
      const end = now()
      let res
      if (mode === 'instant') {
        res = await api.get('/vm/query', { params: { query } })
      } else {
        res = await api.get('/vm/query_range', { params: { query, start, end, step: '15s' } })
      }
      const data = res.data?.data
      if (data?.result) setResults(data.result)
      else { setResults([]); message.info('无数据') }
      loadHistory()
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || '查询失败'
      setError(msg); setResults([])
    }
    setLoading(false)
  }

  const allKeys = results.length > 0 ? [...new Set(results.flatMap(s => Object.keys(s.metric)))] : []

  const columns = allKeys.map(k => ({
    title: k, dataIndex: ['metric', k], width: 120, ellipsis: true,
    render: (v: string) => v || <Text type="secondary">—</Text>,
  }))
  columns.push({
    title: '值', dataIndex: 'value', width: 100, align: 'center' as const,
    render: (_: any, r: any) => {
      if (mode === 'range') return <Text>{r.values?.length || 0} 个点</Text>
      const v = r.value?.[1]
      return v ? v : '—'
    },
  })

  return (
    <div style={{ padding: 16 }}>
      <Title level={5} style={{ marginBottom: 12 }}>PromQL 查询</Title>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
          <TextArea rows={2} value={expr} onChange={e => setExpr(e.target.value)}
            placeholder="输入 PromQL 表达式，如 up{job='node'}" onPressEnter={() => execute()}
            style={{ fontFamily: 'monospace', fontSize: 13 }} />
        </Space.Compact>
        <Space style={{ width: '100%', flexWrap: true }}>
          <Select value={`${mode}|${range}`} onChange={v => { const [m, r] = v.split('|'); setMode(m as any); setRange(r) }}
            style={{ width: 180 }} options={[
              { label: '范围 5m', value: 'range|5m' },
              { label: '范围 30m', value: 'range|30m' },
              { label: '范围 1h', value: 'range|1h' },
              { label: '范围 6h', value: 'range|6h' },
              { label: '范围 1d', value: 'range|1d' },
              { label: '范围 7d', value: 'range|7d' },
              { label: '瞬时', value: 'instant|5m' },
            ]} />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => execute()} loading={loading}>查询</Button>
          <Select showSearch allowClear placeholder="历史查询（支持模糊搜索）" value={undefined}
            onSearch={setKeyword} onSelect={(v: string) => { setExpr(v); setKeyword('') }}
            filterOption={false} style={{ minWidth: 300, flex: 1 }} dropdownMatchSelectWidth={false}
            options={history.map(h => ({ value: h.promql, label: h.promql }))} />
        </Space>
      </Card>

      {loading && <Spin style={{ display: 'block', margin: '40px auto' }} />}
      {error && <Card size="small" style={{ marginBottom: 12, borderColor: '#ff4d4f' }}><Text type="danger">{error}</Text></Card>}

      {results.length > 0 && (
        <Card size="small" title={`结果 (${results.length} 条时间序列)`}>
          <Table rowKey={(r, i) => i + ''} dataSource={results} size="small" pagination={false}
            scroll={{ x: 800 }} bordered columns={columns as any} />
        </Card>
      )}
    </div>
  )
}
