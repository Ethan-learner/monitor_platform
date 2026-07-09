import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })

interface FlowChartProps {
  chart: string
}

export default function FlowChart({ chart }: FlowChartProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    mermaid.render('topology-svg', chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg
    })
  }, [chart])

  return <div ref={ref} style={{ overflow: 'auto', padding: 16, background: '#fafafa', borderRadius: 8 }} />
}
