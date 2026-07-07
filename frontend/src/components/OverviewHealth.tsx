import { Card, Tag, Row, Col, Spin } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ComponentHealth } from '../lib/overview'

interface OverviewHealthProps {
  health: ComponentHealth[]
  loading?: boolean
}

export default function OverviewHealth({ health, loading }: OverviewHealthProps) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
  }
  return (
    <Row gutter={[12, 12]}>
      {health.map((c) => (
        <Col key={c.name} xs={12} sm={8} md={6} lg={4}>
          <Card size="small" bodyStyle={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{c.name}</div>
            {c.status === 'up' ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
            ) : (
              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
            )}
            <div style={{ marginTop: 8 }}>
              <Tag color={c.status === 'up' ? 'green' : 'red'}>{c.status === 'up' ? '正常' : '异常'}</Tag>
            </div>
            {c.latencyMs != null && (
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{c.latencyMs}ms</div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  )
}
