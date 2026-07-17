import { useEffect, useState, useCallback, useRef } from 'react'
import { Input, Button, Typography, Tag, Table, Card, message, Spin, Select, Tooltip, Segmented } from 'antd'
import { SearchOutlined, HistoryOutlined } from '@ant-design/icons'

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
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table')

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
      if (mode === 'range') {
        const vals = r.values
        if (vals && vals.length > 0) return vals[vals.length - 1][1]
        return '—'
      }
      const v = r.value?.[1]
      return v ? v : '—'
    },
  })

  return (
    <div style={{ padding: 16 }}>
      <Title level={5} style={{ marginBottom: 12 }}>PromQL 查询</Title>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
          <TextArea rows={1} value={expr} onChange={e => setExpr(e.target.value)}
            placeholder="输入 PromQL 表达式，如 up{job='node'}" onPressEnter={() => execute()}
            style={{ fontFamily: 'monospace', fontSize: 13, resize: 'none', lineHeight: '32px', padding: '4px 11px' }} />
        </Space.Compact>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 280, flex: 1 }}>
            <Tooltip title="历史查询"><HistoryOutlined style={{ color: '#999', fontSize: 16 }} /></Tooltip>
            <Select showSearch allowClear placeholder="" value={undefined}
              onSearch={setKeyword} onSelect={(v: string) => { setExpr(v); setKeyword('') }}
              filterOption={false} style={{ flex: 1 }} dropdownMatchSelectWidth={false}
              options={Array.from(new Map(history.map(h => [h.promql, h])).values()).map(h => ({ value: h.promql, label: h.promql }))} />
          </div>
          <Select value={`${mode}|${range}`} onChange={v => { const [m, r] = v.split('|'); setMode(m as any); setRange(r) }}
            style={{ width: 170 }} options={[
              { label: '范围 5m', value: 'range|5m' }, { label: '范围 30m', value: 'range|30m' },
              { label: '范围 1h', value: 'range|1h' }, { label: '范围 6h', value: 'range|6h' },
              { label: '范围 1d', value: 'range|1d' }, { label: '范围 7d', value: 'range|7d' },
              { label: '瞬时', value: 'instant|5m' },
            ]} />
          {results.length > 0 && mode === 'range' && (
            <Segmented options={[{ value: 'table', label: 'Table' }, { value: 'graph', label: 'Graph' }]} value={viewMode} onChange={v => setViewMode(v as any)} />
          )}
          <Button type="primary" icon={<SearchOutlined />} onClick={() => execute()} loading={loading}>查询</Button>
        </div>
      </Card>

      {loading && <Spin style={{ display: 'block', margin: '40px auto' }} />}
      {error && <Card size="small" style={{ marginBottom: 12, borderColor: '#ff4d4f' }}><Text type="danger">{error}</Text></Card>}

      {results.length > 0 && (
        <Card size="small" title={`结果 (${results.length} 条时间序列)`}>
          {viewMode === 'graph' && mode === 'range' ? (
            <div style={{ height: 300 }}><SimpleChart data={results} /></div>
          ) : (
            <Table rowKey={(r, i) => i + ''} dataSource={results} size="small" pagination={false}
              scroll={{ x: 800 }} bordered columns={columns as any} />
          )}
        </Card>
      )}
    </div>
  )
}

function SimpleChart({ data }: { data: any[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || data.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth, H = canvas.offsetHeight
    canvas.width = W * dpr; canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const points: { t: number; v: number; label: string }[] = []
    for (const s of data) {
      const label = Object.values(s.metric || {}).slice(0, 3).join(', ')
      for (const [t, v] of s.values || []) {
        const n = parseFloat(v)
        if (!isNaN(n)) points.push({ t, v: n, label })
      }
    }
    if (points.length === 0) return

    const pad = { t: 20, r: 12, b: 24, l: 50 }
    const minT = Math.min(...points.map(p => p.t))
    const maxT = Math.max(...points.map(p => p.t))
    const minV = Math.min(...points.map(p => p.v))
    const maxV = Math.max(...points.map(p => p.v))
    const tR = maxT - minT || 1, vR = maxV - minV || 1
    const x = (t: number) => pad.l + ((t - minT) / tR) * (W - pad.l - pad.r)
    const y = (v: number) => H - pad.b - ((v - minV) / vR) * (H - pad.t - pad.b)

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.5
    for (let i = 0; i <= 5; i++) {
      const yy = pad.t + (i / 5) * (H - pad.t - pad.b)
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(W - pad.r, yy); ctx.stroke()
      ctx.fillStyle = '#999'; ctx.font = '11px sans-serif'
      const val = maxV - (i / 5) * vR
      ctx.textAlign = 'right'; ctx.fillText(val.toFixed(1), pad.l - 4, yy + 4)
    }
    // Time labels
    ctx.fillStyle = '#999'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'
    for (let i = 0; i <= 3; i++) {
      const tt = minT + (i / 3) * tR
      ctx.fillText(new Date(tt * 1000).toLocaleTimeString(), x(tt), H - 4)
    }

    // Series
    const colors = ['#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2']
    const groups = new Map<string, { t: number; v: number }[]>()
    for (const s of data) {
      const label = Object.values(s.metric || {}).slice(0, 3).join(', ')
      if (!groups.has(label)) groups.set(label, [])
      for (const [t, v] of s.values || []) {
        const n = parseFloat(v)
        if (!isNaN(n)) groups.get(label)!.push({ t, v: n })
      }
    }
    let ci = 0
    for (const [_, pts] of groups) {
      if (pts.length < 2) continue
      pts.sort((a, b) => a.t - b.t)
      ctx.strokeStyle = colors[ci % colors.length]; ctx.lineWidth = 1.5
      ctx.beginPath()
      pts.forEach((p, i) => { const px = x(p.t), py = y(p.v); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py) })
      ctx.stroke()
      ci++
    }
  }, [data])
  return <canvas ref={ref} style={{ width: '100%', height: '100%', borderRadius: 4 }} />
}
