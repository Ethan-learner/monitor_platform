import { useEffect, useState } from 'react'
import { Form, Input, Button, DatePicker, message, Card, Typography, Space } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { createSilence } from '../lib/rules'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function SilenceNew() {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const state = (location.state as any) || {}
    if (state.alertName) {
      form.setFieldsValue({
        matcherName: 'alertname',
        matcherValue: state.alertName,
        createdBy: state.createdBy || 'admin',
      })
    }
  }, [])

  const handleFinish = async (values: any) => {
    setLoading(true)
    try {
      const [start, end] = values.timeRange || []
      const body = {
        matchers: [{ name: values.matcherName || 'alertname', value: values.matcherValue, isRegex: false }],
        startsAt: start?.toISOString() || new Date().toISOString(),
        endsAt: end?.toISOString() || new Date(Date.now() + 3600000).toISOString(),
        createdBy: values.createdBy || 'admin',
        comment: values.comment || '',
      }
      await createSilence(body)
      message.success('静默创建成功')
      navigate('/dashboard/silence-list')
    } catch { message.error('创建失败') } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 16, maxWidth: 600 }}>
      <Title level={5}>新建静默</Title>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ createdBy: 'admin', matcherName: 'alertname' }}>
          <Form.Item label="匹配标签名" name="matcherName"><Input placeholder="alertname" /></Form.Item>
          <Form.Item label="匹配值" name="matcherValue" rules={[{ required: true, message: '必填' }]}><Input placeholder="InstanceDown" /></Form.Item>
          <Form.Item label="时间段" name="timeRange" rules={[{ required: true, message: '请选择时间' }]}>
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="创建人" name="createdBy"><Input /></Form.Item>
          <Form.Item label="备注" name="comment"><Input.TextArea rows={3} placeholder="维护窗口" /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>创建</Button>
            <Button onClick={() => navigate('/dashboard/silence-list')}>取消</Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
