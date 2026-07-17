import { useEffect, useState, useRef, useCallback } from 'react'
import { Input, Button, Space, Typography, Tag, Table, Card, message, Spin, Select } from 'antd'
import { SearchOutlined, HistoryOutlined } from '@ant-design/icons'
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

  const ranges = [
    { label: '5m', value: '5m' },
    { label: '30m', value: '30m' },
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '1d', value: '1d' },
    { label: '7d', value: '7d' },
  ]

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
      return v ? parseFloat(v).toFixed(2) : '—'
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
        <Space style={{ marginBottom: 8 }}>
          <Button type="primary" icon={<SearchOutlined />} onClick={() => execute()} loading={loading}>查询</Button>
          <Button size="small" onClick={() => setMode(mode === 'instant' ? 'range' : 'instant')}>
            {mode === 'instant' ? '瞬时' : '范围'}
          </Button>
          {ranges.map(r => (
            <Button key={r.value} size="small" type={range === r.value ? 'primary' : 'default'}
              onClick={() => setRange(r.value)}>{r.label}</Button>
          ))}
        </Space>
        <Space style={{ width: '100%' }}>
          <HistoryOutlined style={{ color: '#999' }} />
          <Select showSearch allowClear placeholder="历史查询（支持模糊搜索）"
            value={undefined} onSearch={setKeyword} onSelect={(v: string) => { setExpr(v); setKeyword('') }}
            filterOption={false} style={{ flex: 1 }}
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
