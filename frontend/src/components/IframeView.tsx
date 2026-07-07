interface IframeViewProps {
  url: string;
  title?: string;
}

export default function IframeView({ url, title }: IframeViewProps) {
  return (
    <iframe
      src={url}
      title={title || '监控看板'}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
}
