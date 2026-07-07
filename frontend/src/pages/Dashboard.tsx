import IframeView from '../components/IframeView'

interface DashboardProps {
  url: string
  title?: string
  hideHeader?: boolean
}

export default function Dashboard({ url, title, hideHeader }: DashboardProps) {
  if (!url) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
        暂无可用看板
      </div>
    )
  }

  return <IframeView url={url} title={title} hideHeader={hideHeader} />
}
