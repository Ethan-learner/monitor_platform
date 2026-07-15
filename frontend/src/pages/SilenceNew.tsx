import { useEffect, useState } from 'react'
import { Form, Input, Button, DatePicker, message, Card, Typography, Space, Select } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { createSilence } from '../lib/rules'

const { Title } = Typography
const { RangePicker } = DatePicker

interface Matcher { name: string; value: string; isRegex: boolean }
const emptyMatcher = (): Matcher => ({ name: 'alertname', value: '', isRegex: false })

export default function SilenceNew() {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [matchers, setMatchers] = useState<Matcher[]>([emptyMatcher()])
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const state = (location.state as any) || {}
    if (state.alertName) {
      const ms: Matcher[] = [{ name: 'alertname', value: state.alertName, isRegex: false }]
      if (state.alertLabels) {
        for (const [k, v] of Object.entries(state.alertLabels as Record<string, string>)) {
          if (k !== 'alertname' && v) ms.push({ name: k, value: v, isRegex: false })
        }
      }
      setMatchers(ms)
    }
  }, [])

  const handleFinish = async (values: any) => {
    const [start, end] = values.timeRange || []
    if (!end || end.isBefore(dayjs())) { message.warning('结束时间不能小于当前时间'); return }
    setLoading(true)
    try {
      await createSilence({
        matchers: matchers.filter(m => m.name && m.value),
        startsAt: start?.format('YYYY-MM-DD HH:mm:ss') || dayjs().format('YYYY-MM-DD HH:mm:ss'),
        endsAt: end.format('YYYY-MM-DD HH:mm:ss'),
        comment: values.comment || '',
      })
      message.success('静默创建成功')
      navigate('/dashboard/alertmanager-silences')
    } catch { message.error('创建失败') } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 16, maxWidth: 600 }}>
      <Title level={5}>新建静默</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Form.Item label="匹配规则" required style={{ marginBottom: 12 }}>
            {matchers.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <Select value={m.name} onChange={v => setMatchers(prev => prev.map((x, j) => j === i ? { ...x, name: v } : x))}
                  style={{ width: 150 }} options={['alertname', 'instance', 'job', 'severity', 'service', 'env'].map(s => ({ label: s, value: s }))} />
                <Select value={m.isRegex ? '=~' : '='} onChange={v => setMatchers(prev => prev.map((x, j) => j === i ? { ...x, isRegex: v === '=~' } : x))}
                  style={{ width: 60 }}>
                  <Select.Option value="=">=</Select.Option>
                  <Select.Option value="=~">=~</Select.Option>
                </Select>
                <Input value={m.value} onChange={e => setMatchers(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  placeholder="匹配值" style={{ flex: 1 }} />
                {matchers.length > 1 && <Button type="text" size="small" icon={<MinusCircleOutlined />} onClick={() => setMatchers(prev => prev.filter((_, j) => j !== i))} danger />}
              </div>
            ))}
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setMatchers(prev => [...prev, emptyMatcher()])} block>添加条件</Button>
          </Form.Item>
          <Form.Item label="时间段" name="timeRange" rules={[{ required: true, message: '请选择时间' }, ({ getFieldValue }) => ({
            validator(_, value) { if (value && value[0] && value[1] && !value[1].isAfter(value[0])) return Promise.reject('结束时间必须大于开始时间'); return Promise.resolve() }
          })]}>
            <RangePicker showTime style={{ width: '100%' }} disabledDate={(d: any) => d && d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          <Form.Item label="备注" name="comment"><Input.TextArea rows={3} placeholder="维护窗口" /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>创建</Button>
            <Button onClick={() => navigate('/dashboard/alertmanager-silences')}>取消</Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
