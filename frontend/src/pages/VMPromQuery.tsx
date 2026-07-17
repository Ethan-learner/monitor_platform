import { useEffect, useState, useRef } from 'react'
import { Input, Button, Space, Typography, Tag, Table, Card, message, Spin } from 'antd'
import { SearchOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { api } from '../lib/api'

const { Title, Text } = Typography
const { TextArea } = Input

interface Series { metric: Record<string, string>; values: [number, string][] }

export default function VMPromQuery() {
  const [expr, setExpr] = useState('')
  const [results, setResults] = useState<Series[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'instant' | 'range'>('range')
  const [range, setRange] = useState('1h')
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('vmq_history') || '[]') } catch { return [] }
  })

  const ranges = [
    { label: '5m', value: '5m' },
    { label: '30m', value: '30m' },
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '1d', value: '1d' },
    { label: '7d', value: '7d' },
  ]

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

  const execute = async () => {
    if (!expr.trim()) { message.warning('请输入 PromQL'); return }
    setLoading(true); setError('')
    try {
      const duration = parseDuration(range)
      const start = now() - duration
      const end = now()
      let res
      if (mode === 'instant') {
        res = await api.get('/vm/query', { params: { query: expr } })
      } else {
        res = await api.get('/vm/query_range', { params: { query: expr, start, end, step: '15s' } })
      }
      const data = res.data?.data
      if (data?.result) setResults(data.result)
      else { setResults([]); message.info('无数据') }
      const newHistory = [expr, ...history.filter(h => h !== expr)].slice(0, 20)
      setHistory(newHistory)
      localStorage.setItem('vmq_history', JSON.stringify(newHistory))
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
            placeholder="输入 PromQL 表达式，如 up{job='node'}" onPressEnter={execute}
            style={{ fontFamily: 'monospace', fontSize: 13, width: '100%' }} />
        </Space.Compact>
        <Space style={{ marginBottom: 8 }}>
          <Button type="primary" icon={<SearchOutlined />} onClick={execute} loading={loading}>查询</Button>
          <Button size="small" onClick={() => setMode(mode === 'instant' ? 'range' : 'instant')}>
            {mode === 'instant' ? '瞬时' : '范围'}
          </Button>
          {ranges.map(r => (
            <Button key={r.value} size="small" type={range === r.value ? 'primary' : 'default'}
              onClick={() => setRange(r.value)}>{r.label}</Button>
          ))}
        </Space>
        {history.length > 0 && (
          <Space wrap style={{ marginTop: 4 }}>
            <ClockCircleOutlined style={{ color: '#999', fontSize: 11 }} />
            {history.slice(0, 8).map(h => (
              <Tag key={h} style={{ cursor: 'pointer', fontSize: 11 }} onClick={() => setExpr(h)}>{h}</Tag>
            ))}
          </Space>
        )}
      </Card>

      {loading && <Spin style={{ display: 'block', margin: '40px auto' }} />}
      {error && <Card size="small" style={{ marginBottom: 12, borderColor: '#ff4d4f' }}><Text type="danger">{error}</Text></Card>}

      {results.length > 0 && (
        <Card size="small" title={`结果 (${results.length} 条时间序列)`}>
          {results.length <= 30 && (
            <div style={{ marginBottom: 12, height: 200, position: 'relative' }}>
              <SimpleChart data={results} />
            </div>
          )}
          <Table rowKey={(r, i) => i + ''} dataSource={results} size="small" pagination={false}
            scroll={{ x: 800 }} bordered columns={columns as any} />
        </Card>
      )}
    </div>
  )
}

function SimpleChart({ data }: { data: Series[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width = canvas.offsetWidth * 2
    const H = canvas.height = 200 * 2
    ctx.scale(2, 2)
    const w = canvas.offsetWidth
    const h = 200

    // Collect all time-value pairs
    const allPoints: { time: number; val: number; label: string }[] = []
    for (const s of data) {
      const label = Object.values(s.metric).slice(0, 2).join(', ')
      for (const [t, v] of s.values || []) {
        const val = parseFloat(v)
        if (!isNaN(val)) allPoints.push({ time: t, val, label })
      }
    }
    if (allPoints.length === 0) return

    const minTime = Math.min(...allPoints.map(p => p.time))
    const maxTime = Math.max(...allPoints.map(p => p.time))
    const minVal = Math.min(...allPoints.map(p => p.val))
    const maxVal = Math.max(...allPoints.map(p => p.val))
    const pad = 8
    const timeRange = maxTime - minTime || 1
    const valRange = maxVal - minVal || 1

    const x = (t: number) => pad + ((t - minTime) / timeRange) * (w - pad * 2)
    const y = (v: number) => h - pad - ((v - minVal) / valRange) * (h - pad * 2)

    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.5
    for (let i = 0; i < 5; i++) {
      const yy = pad + (i / 4) * (h - pad * 2)
      ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(w - pad, yy); ctx.stroke()
    }

    const colors = ['#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2']
    const series = new Map<string, { time: number; val: number }[]>()
    for (const s of data) {
      const label = Object.values(s.metric).slice(0, 2).join(', ')
      if (!series.has(label)) series.set(label, [])
      for (const [t, v] of s.values || []) {
        const val = parseFloat(v)
        if (!isNaN(val)) series.get(label)!.push({ time: t, val })
      }
    }

    let ci = 0
    for (const [label, points] of series) {
      if (points.length < 2) continue
      points.sort((a, b) => a.time - b.time)
      const color = colors[ci % colors.length]
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath()
      points.forEach((p, i) => {
        const px = x(p.time), py = y(p.val)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      })
      ctx.stroke()
      ci++
    }
  }, [data])

  return <canvas ref={canvasRef} style={{ width: '100%', height: 200, borderRadius: 4 }} />
}
