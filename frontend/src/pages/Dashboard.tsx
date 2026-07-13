import { useEffect, useState } from 'react'
import IframeView from '../components/IframeView'

interface DashboardProps {
  url: string
  title?: string
  hideHeader?: boolean
}

export default function Dashboard({ url, title, hideHeader }: DashboardProps) {
  const [iframeKeys, setIframeKeys] = useState<string[]>([])

  useEffect(() => {
    if (!url) return
    setIframeKeys((prev) => {
      if (prev.indexOf(url) >= 0) return prev
      const next = [url, ...prev]
      return next.length > 5 ? next.slice(0, 5) : next
    })
  }, [url])

  if (!url) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
        暂无可用看板
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {iframeKeys.map((key) => (
        <div key={key} style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: key === url ? 'block' : 'none',
        }}>
          <IframeView url={key} title={title} hideHeader={hideHeader} />
        </div>
      ))}
    </div>
  )
}
