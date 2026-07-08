interface IframeViewProps {
  url: string
  title?: string
  hideHeader?: boolean
}

export default function IframeView({ url, title, hideHeader }: IframeViewProps) {
  if (hideHeader) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        <iframe
          src={url}
          title={title || '监控看板'}
          style={{ width: '100%', height: 'calc(100% + 60px)', border: 'none', marginTop: -60 }}
        />
      </div>
    )
  }

  return (
    <iframe
      src={url}
      title={title || '监控看板'}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  )
}
