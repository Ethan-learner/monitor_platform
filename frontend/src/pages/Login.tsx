import { Card, Typography, Button, Form, Input, message } from 'antd'
import {
  LoginOutlined,
  UserOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

const { Title, Text } = Typography

const RING_SLICES = [
  { label: 'Critical', pct: 36, color: '#ff4d4f', offset: 0 },
  { label: 'Warning', pct: 44, color: '#faad14', offset: 36 },
  { label: 'Info', pct: 20, color: '#1677ff', offset: 80 },
]

const BAR_DATA = [
  { label: 'Host', value: 31, pct: 100, color: '#ff4d4f' },
  { label: 'DB', value: 18, pct: 58, color: '#faad14' },
  { label: 'App', value: 22, pct: 71, color: '#1677ff' },
  { label: 'Net', value: 12, pct: 39, color: '#52c41a' },
  { label: 'Custom', value: 7, pct: 23, color: '#722ed1' },
]

const SPARK_DATA = [
  { color: '#ff4d4f', values: [4, 6, 3, 8, 12, 7, 14, 18, 11, 16, 20, 15] },
  { color: '#faad14', values: [30, 45, 38, 52, 44, 58, 50, 65, 55, 70, 62, 78] },
  { color: '#1677ff', values: [12, 18, 15, 22, 19, 25, 21, 28, 24, 30, 27, 35] },
  { color: '#52c41a', values: [5, 8, 6, 10, 9, 12, 11, 15, 13, 16, 14, 18] },
]

const LOG_LINES = [
  '[INFO]  metrics collector started, interval=15s',
  '[WARN]  prom-29 response time 487ms > 300ms',
  '[ALERT] InstanceDown 10.0.1.27:9100 (no data 5m)',
  '[INFO]  silence rule #103 activated: app=api-*',
  '[WARN]  rule preview: HighCPU matches 84 targets',
  '[ALERT] DiskFull>90% db-02: 94.2% used, 12GB left',
  '[INFO]  webhook push ok email -> zhulei1@...',
  '[WARN]  Alertmanager queue depth: 342 (> 200)',
  '[ALERT] OOMKill app-svc-6: pod restarted 3x/5m',
  '[INFO]  /-/reload triggered: 3 nodes success',
  '[WARN]  VM select slow query 2.3s > 1s threshold',
  '[ALERT] Blackbox timeout 10.0.1.88: health check',
]

const COUNTERS = [
  { label: '当前告警', value: 128, unit: '' },
  { label: 'QPS 峰值', value: 24.6, unit: 'K' },
  { label: '响应延迟', value: 187, unit: 'ms' },
  { label: '采集节点', value: 352, unit: '' },
  { label: '错误率', value: 0.37, unit: '%' },
  { label: '吞吐量', value: 82, unit: 'MB/s' },
]

const NODES_TIMELINE: { time: string; label: string; sev: keyof typeof SEV_C; duration: string }[] = [
  { time: '17:39', label: 'InstanceDown', sev: 'crit', duration: '12m' },
  { time: '17:41', label: 'HighCPU', sev: 'warn', duration: '8m' },
  { time: '17:42', label: 'DiskFull', sev: 'crit', duration: 'ongoing' },
  { time: '17:44', label: 'RedisDown', sev: 'crit', duration: 'resolved' },
  { time: '17:46', label: 'SlowQuery', sev: 'warn', duration: '5m' },
  { time: '17:48', label: 'PodRestart', sev: 'info', duration: '1m' },
]

const HEAT_DATA = [
  [32, 18, 45, 12, 28, 9],
  [15, 42, 8, 36, 21, 5],
  [48, 20, 3, 29, 16, 38],
  [10, 35, 24, 6, 40, 14],
  [22, 7, 44, 17, 4, 30],
  [11, 26, 33, 19, 2, 41],
]

const SCORE_LINES = [
  { label: 'CPU', v1: 72, v2: 85, v3: 60, v4: 78, v5: 82 },
  { label: 'Mem', v1: 65, v2: 55, v3: 80, v4: 70, v5: 75 },
  { label: 'Disk', v1: 88, v2: 92, v3: 78, v4: 85, v5: 80 },
  { label: 'Net', v1: 45, v2: 60, v3: 55, v4: 70, v5: 50 },
  { label: 'QPS', v1: 30, v2: 45, v3: 55, v4: 65, v5: 80 },
]

const SEV_C = { ok: '#52c41a', warn: '#faad14', crit: '#ff4d4f', info: '#1677ff' } as const

const STATUS_BADGES: { label: string; status: keyof typeof SEV_C }[] = [
  { label: 'Prom-27', status: 'ok' },
  { label: 'Prom-28', status: 'ok' },
  { label: 'Prom-29', status: 'warn' },
  { label: 'AM', status: 'crit' },
  { label: 'WH-27', status: 'ok' },
  { label: 'WH-28', status: 'ok' },
  { label: 'WH-29', status: 'crit' },
  { label: 'MySQL', status: 'ok' },
  { label: 'VM', status: 'ok' },
  { label: 'Loki', status: 'warn' },
  { label: 'VM', status: 'ok' },
]

export default function Login() {
  const { isAuthenticated, init } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleFinish = async (values: { username: string; password: string }) => {
    try {
      const { data } = await api.post('/auth/login', values)
      await init()
      message.success(`欢迎回来，${data.displayName}`)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '登录失败')
    }
  }

  const renderSpark = (s: typeof SPARK_DATA[number], i: number, w: number, h: number) => {
    const maxV = Math.max(...s.values)
    const pts = s.values.map((v, j) => `${(j / (s.values.length - 1)) * w},${h - (v / maxV) * (h - 8) - 4}`).join(' ')
    return (
      <svg key={i} width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ margin: '0 2px' }}>
        <polyline points={pts} fill="none" stroke={s.color} strokeWidth="1.5" strokeDasharray="400" strokeDashoffset="400">
          <animate attributeName="stroke-dashoffset" from="400" to="0" dur="3s" repeatCount="indefinite" />
        </polyline>
      </svg>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#070a14',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'ui-monospace, -apple-system, sans-serif',
      }}
    >
      <style>{`
        @keyframes p-grid {
          0%   { background-position: 0 0, 0 0; }
          100% { background-position: 28px 28px, 28px 28px; }
        }
        @keyframes p-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.2; }
        }
        @keyframes p-roll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes p-tick {
          0%   { transform: scaleY(0.3); }
          50%  { transform: scaleY(1); }
          100% { transform: scaleY(0.3); }
        }
        @keyframes p-needle {
          0%   { transform: rotate(25deg); }
          50%  { transform: rotate(80deg); }
          100% { transform: rotate(25deg); }
        }
        @keyframes p-scanY {
          0%   { transform: translateY(-100%); opacity: 0; }
          15%  { opacity: 0.6; }
          85%  { opacity: 0.6; }
          100% { transform: translateY(100vh);  opacity: 0; }
        }
        @keyframes p-glow {
          0%, 100% { filter: drop-shadow(0 0 3px currentColor); }
          50%      { filter: drop-shadow(0 0 10px currentColor); }
        }
        @keyframes p-spin {
          to { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes p-scatter {
          0%   { transform: translate(0,0); opacity: 0.3; }
          50%  { transform: translate(3px,-3px); opacity: 1; }
          100% { transform: translate(0,0); opacity: 0.3; }
        }
        @keyframes p-wave {
          0%   { d: path("M0,30 Q20,10 40,30 T80,30 T120,30 T160,30 T200,30"); }
          50%  { d: path("M0,30 Q20,50 40,30 T80,30 T120,30 T160,30 T200,30"); }
          100% { d: path("M0,30 Q20,10 40,30 T80,30 T120,30 T160,30 T200,30"); }
        }
        @keyframes p-barGrow {
          0%   { transform: scaleY(1); }
          50%  { transform: scaleY(1.2); }
          100% { transform: scaleY(1); }
        }
        @keyframes p-lineDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes p-dashMove {
          to { stroke-dashoffset: -24; }
        }
      `}</style>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(60,100,180,0.05) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(60,100,180,0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          animation: 'p-grid 18s linear infinite',
          pointerEvents: 'none',
        }}
      />

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          height: 1.5,
          left: 0,
          right: 0,
          background: 'linear-gradient(90deg, transparent, rgba(22,119,255,0.6), rgba(255,77,79,0.6), transparent)',
          filter: 'drop-shadow(0 0 6px rgba(22,119,255,0.5))',
          animation: 'p-scanY 7s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '2%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 18,
          padding: '6px 20px',
          border: '1px solid rgba(60,100,180,0.12)',
          borderRadius: 20,
          background: 'rgba(10,14,26,0.65)',
          fontSize: 10,
          color: 'rgba(180,200,240,0.7)',
          letterSpacing: 1,
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
        }}
      >
        {[
          { color: '#ff4d4f', text: 'CRIT 18' },
          { color: '#faad14', text: 'WARN 22' },
          { color: '#1677ff', text: 'INFO 10' },
          { color: '#52c41a', text: 'OK 284' },
          { color: '#8c8c8c', text: 'MAINT 3' },
        ].map((it, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: it.color,
                boxShadow: `0 0 5px ${it.color}`,
                animation: `p-blink ${1.6 + i * 0.3}s ease-in-out infinite`,
              }}
            />
            {it.text}
          </span>
        ))}
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '9%',
          left: '1.5%',
          width: '18%',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>ALERT SEVERITY · 50 TOTAL</div>
        <div style={{ display: 'flex', justifyContent: 'center', height: 110 }}>
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(60,100,180,0.08)" strokeWidth="18" />
            {RING_SLICES.map((s) => {
              const r = 42
              const circ = 2 * Math.PI * r
              const dash = (s.pct / 100) * circ
              const offsetVal = -(RING_SLICES.slice(0, RING_SLICES.indexOf(s)).reduce((a, b) => a + b.pct, 0) / 100) * circ
              return (
                <circle
                  key={s.label}
                  cx="55"
                  cy="55"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="18"
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={offsetVal}
                  transform="rotate(-90 55 55)"
                  style={{ filter: `drop-shadow(0 0 4px ${s.color})` }}
                >
                  <animate attributeName="stroke-dashoffset" from={offsetVal + 50} to={offsetVal} dur="1s" fill="freeze" />
                </circle>
              )
            })}
            <text x="55" y="53" textAnchor="middle" fill="#e6f0ff" fontSize="16" fontWeight="700">50</text>
            <text x="55" y="66" textAnchor="middle" fill="rgba(140,170,210,0.4)" fontSize="8">total</text>
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6, fontSize: 9 }}>
          {RING_SLICES.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, boxShadow: `0 0 4px ${s.color}` }} />
              <span style={{ color: 'rgba(180,200,240,0.6)' }}>{s.label}</span>
              <span style={{ color: s.color }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '9%',
          left: '21%',
          width: '17%',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>ALERTS BY CATEGORY</div>
        <div style={{ border: '1px solid rgba(60,100,180,0.1)', background: 'rgba(10,14,26,0.6)', borderRadius: 6, padding: '8px 10px' }}>
          {BAR_DATA.map((b) => (
            <div key={b.label} style={{ marginBottom: 5, fontSize: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(180,200,240,0.7)', marginBottom: 1 }}>
                <span>{b.label}</span>
                <span style={{ color: b.color, fontWeight: 600 }}>{b.value}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(60,100,180,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: 2, boxShadow: `0 0 4px ${b.color}` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '30%',
          left: '1.5%',
          width: '10%',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>TREND</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SPARK_DATA.map((s, i) => (
            <div key={i} style={{ background: 'rgba(10,14,26,0.5)', borderRadius: 4, padding: '2px 4px' }}>
              {renderSpark(s, i, 110, 32)}
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '30%',
          left: '12.5%',
          width: '10%',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>NODES STATUS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, background: 'rgba(10,14,26,0.5)', borderRadius: 6, padding: 6 }}>
          {STATUS_BADGES.map((n, i) => (
            <span
              key={i}
              style={{
                fontSize: 8,
                padding: '2px 5px',
                borderRadius: 4,
                border: `1px solid ${SEV_C[n.status]}44`,
                color: SEV_C[n.status],
                background: `${SEV_C[n.status]}11`,
                animation: n.status === 'crit' ? 'p-blink 1s ease-in-out infinite' : undefined,
              }}
            >
              ● {n.label}
            </span>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '8%',
          right: '1.5%',
          width: '100px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4, textAlign: 'right' }}>HEALTH</div>
        <svg width="100" height="110" viewBox="0 0 100 110">
          <path d="M50 10 L85 30 L85 70 L50 90 L15 70 L15 30 Z" fill="none" stroke="rgba(60,100,180,0.15)" strokeWidth="1" />
          <polygon points="50,20 70,32 70,58 50,70 30,58 30,32" fill="rgba(82,196,26,0.15)" stroke="#52c41a" strokeWidth="1" />
          <polygon points="50,30 62,38 62,55 50,62 38,55 38,38" fill="rgba(250,173,20,0.12)" stroke="#faad14" strokeWidth="0.8" opacity="0.8" />
          <polygon points="50,38 56,43 56,51 50,55 44,51 44,43" fill="rgba(255,77,79,0.1)" stroke="#ff4d4f" strokeWidth="0.6" opacity="0.6" />
          <circle cx="50" cy="50" r="4" fill="#ff4d4f" style={{ filter: 'drop-shadow(0 0 6px #ff4d4f)' }}>
            <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '40%',
          right: '1%',
          width: '70px',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 2, textAlign: 'center' }}>
          SENSOR
        </div>
        {Array.from({ length: 14 }).map((_, i) => {
          const on = i > 4 && i < 12
          const warn = i === 7 || i === 10
          return (
            <div
              key={i}
              style={{
                height: 2,
                background: on ? (warn ? '#faad14' : '#52c41a') : 'rgba(60,100,180,0.08)',
                borderRadius: 1,
                width: `${60 + (i % 5) * 5}%`,
                margin: '0 auto',
                boxShadow: on ? `0 0 4px ${warn ? '#faad14' : '#52c41a'}` : 'none',
                animation: on ? `p-blink ${1.2 + (i % 4) * 0.2}s ease-in-out infinite` : undefined,
              }}
            />
          )
        })}
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '1%',
          bottom: '26%',
          width: '260px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>ALERT_LOG · TAIL -F</div>
        <div
          style={{
            border: '1px solid rgba(60,100,180,0.1)',
            background: 'rgba(10,14,26,0.6)',
            borderRadius: 6,
            padding: '6px 10px',
            height: 168,
            overflow: 'hidden',
            fontSize: 10,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <div style={{ animation: 'p-roll 35s linear infinite' }}>
            {[...LOG_LINES, ...LOG_LINES].map((line, i) => {
              const isAlert = line.includes('ALERT')
              const isWarn = line.includes('WARN')
              return (
                <div
                  key={i}
                  style={{
                    padding: '1.5px 0',
                    color: isAlert ? '#ff4d4f' : isWarn ? '#faad14' : 'rgba(180,200,240,0.65)',
                    whiteSpace: 'nowrap',
                    animation: isAlert ? 'p-glow 2s ease-in-out infinite' : undefined,
                  }}
                >
                  {line}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '24%',
          bottom: '8%',
          width: '120px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>COUNTERS</div>
        <div
          style={{
            border: '1px solid rgba(60,100,180,0.1)',
            background: 'rgba(10,14,26,0.6)',
            borderRadius: 6,
            padding: '8px 10px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '2px 6px',
          }}
        >
          {COUNTERS.map((c) => (
            <div key={c.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#e6f0ff', fontWeight: 600 }}>
                {c.value}{c.unit}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(140,170,210,0.45)', whiteSpace: 'nowrap' }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '24%',
          bottom: '22%',
          width: '120px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>SCORECARD</div>
        <div style={{ border: '1px solid rgba(60,100,180,0.1)', background: 'rgba(10,14,26,0.6)', borderRadius: 6, padding: '8px 10px' }}>
          {SCORE_LINES.map((l) => {
            const maxV = Math.max(l.v1, l.v2, l.v3, l.v4, l.v5)
            const pts = [l.v1, l.v2, l.v3, l.v4, l.v5].map((v, j) => `${j * 22 + 2},${34 - (v / 100) * 28}`).join(' ')
            return (
              <div key={l.label} style={{ marginBottom: l === SCORE_LINES[SCORE_LINES.length - 1] ? 0 : 3, fontSize: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(180,200,240,0.6)', marginBottom: 1 }}>
                  <span>{l.label}</span>
                  <span style={{ color: maxV > 80 ? '#ff4d4f' : maxV > 60 ? '#faad14' : '#52c41a' }}>{maxV}%</span>
                </div>
                <svg width="100%" height="36" viewBox="0 0 110 36">
                  <polyline points={pts} fill="none" stroke="#1677ff" strokeWidth="1.2" strokeDasharray="200" strokeDashoffset="200">
                    <animate attributeName="stroke-dashoffset" from="200" to="0" dur="4s" repeatCount="indefinite" />
                  </polyline>
                  {[l.v1, l.v2, l.v3, l.v4, l.v5].map((v, j) => (
                    <circle key={j} cx={j * 22 + 2} cy={34 - (v / 100) * 28} r="2" fill={v > 80 ? '#ff4d4f' : v > 60 ? '#faad14' : '#52c41a'} />
                  ))}
                </svg>
              </div>
            )
          })}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '5%',
          bottom: '6%',
          width: '130px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4, textAlign: 'right' }}>SERVICE_HEATMAP</div>
        <div
          style={{
            border: '1px solid rgba(60,100,180,0.1)',
            background: 'rgba(10,14,26,0.6)',
            borderRadius: 6,
            padding: 6,
            display: 'grid',
            gridTemplateColumns: `repeat(${HEAT_DATA[0].length}, 1fr)`,
            gap: 2,
          }}
        >
          {HEAT_DATA.flat().map((v, i) => (
            <div
              key={i}
              style={{
                height: 14,
                borderRadius: 2,
                background: v > 30 ? '#ff4d4f' : v > 15 ? '#faad14' : '#1677ff',
                opacity: 0.2 + (v / 48) * 0.6,
                animation: `p-blink ${2 + (i % 5) * 0.3}s ease-in-out infinite`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 7,
                fontWeight: 600,
              }}
            >
              {v}
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '15%',
          bottom: '25%',
          width: '100px',
          pointerEvents: 'none',
        }}
      >
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(60,100,180,0.1)" strokeWidth="1">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="10s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="50" r="26" fill="none" stroke="rgba(60,100,180,0.08)" strokeWidth="0.8">
            <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="7s" repeatCount="indefinite" />
          </circle>
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i * 22.5 * Math.PI) / 180
            const r = 38
            return (
              <circle
                key={i}
                cx={50 + r * Math.cos(angle)}
                cy={50 + r * Math.sin(angle)}
                r={i % 4 === 0 ? 2.5 : 1.5}
                fill={i % 4 === 0 ? '#ff4d4f' : i % 4 === 2 ? '#faad14' : '#1677ff'}
                style={{ filter: `drop-shadow(0 0 3px ${i % 4 === 0 ? '#ff4d4f' : i % 4 === 2 ? '#faad14' : '#1677ff'})` }}
              />
            )
          })}
          <circle cx="50" cy="50" r="5" fill="#ff4d4f" style={{ filter: 'drop-shadow(0 0 8px #ff4d4f)' }}>
            <animate attributeName="r" values="4;6;4" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '1%',
          top: '57%',
          width: '90px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>EVENTS</div>
        <div style={{ border: '1px solid rgba(60,100,180,0.1)', background: 'rgba(10,14,26,0.6)', borderRadius: 6, padding: '4px 6px' }}>
          {NODES_TIMELINE.map((ev, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 6,
                padding: '2px 0',
                borderBottom: i < NODES_TIMELINE.length - 1 ? '1px dashed rgba(60,100,180,0.06)' : 'none',
                fontSize: 8,
                alignItems: 'center',
              }}
            >
              <span style={{ color: SEV_C[ev.sev], width: 6, height: 6, borderRadius: '50%', background: SEV_C[ev.sev], boxShadow: `0 0 4px ${SEV_C[ev.sev]}` }} />
              <span style={{ color: 'rgba(140,170,210,0.5)', width: 28 }}>{ev.time}</span>
              <span style={{ color: 'rgba(180,200,240,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.label}</span>
              <span style={{ color: SEV_C[ev.sev] }}>{ev.duration}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '5%',
          top: '56%',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 9, color: 'rgba(140,170,210,0.5)', letterSpacing: 1, marginBottom: 4 }}>TRAFFIC</div>
        <svg width="100" height="50" viewBox="0 0 120 50">
          <path d="M0 45 C15 40 20 20 30 35 C35 43 40 8 50 20 C55 26 60 10 70 15 C80 20 85 5 90 12 C95 18 105 2 110 8 C115 14 120 20 120 25 V50 H0 Z"
            fill="#1677ff" opacity="0.25">
            <animateTransform attributeName="transform" type="rotate" values="0 60 25;2 60 25;0 60 25" dur="3s" repeatCount="indefinite" />
          </path>
          <path d="M0 45 C15 40 20 30 30 35 C35 43 40 20 50 25 C55 28 60 18 70 22 C80 26 85 12 90 18 C95 22 105 8 110 14 C115 18 120 22 120 25 V50 H0 Z"
            fill="#ff4d4f" opacity="0.15">
            <animateTransform attributeName="transform" type="rotate" values="0 60 25;-1 60 25;0 60 25" dur="4s" repeatCount="indefinite" />
          </path>
          <path d="M0 45 Q30 5 60 20 T120 25" fill="none" stroke="#1677ff" strokeWidth="1.5" strokeDasharray="4 4" style={{ animation: 'p-dashMove 1.5s linear infinite' }} />
          <path d="M0 50 Q30 15 60 30 T120 35" fill="none" stroke="#ff4d4f" strokeWidth="1" strokeDasharray="3 5" style={{ animation: 'p-dashMove 2s linear infinite' }} />
          <path d="M0 55 Q30 25 60 35 T120 42" fill="none" stroke="#faad14" strokeWidth="0.8" strokeDasharray="2 6" style={{ animation: 'p-dashMove 2.5s linear infinite' }} />
        </svg>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '1%',
          bottom: '30%',
          pointerEvents: 'none',
        }}
      >
        <svg width="80" height="80" viewBox="0 0 80 80">
          {[1, 2, 3, 4].map((ring) => (
            <circle
              key={ring}
              cx="40"
              cy="40"
              r={ring * 8}
              fill="none"
              stroke={`rgba(60,100,180,${0.08 - ring * 0.01})`}
              strokeWidth="0.6"
            />
          ))}
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180
            const x1 = 40 + 32 * Math.cos(a)
            const y1 = 40 + 32 * Math.sin(a)
            return (
              <circle key={i} cx={x1} cy={y1} r="1.5" fill={i % 3 === 0 ? '#ff4d4f' : i % 3 === 1 ? '#faad14' : '#1677ff'}>
                <animate attributeName="r" values="1;2.5;1" dur={`${1.5 + (i % 4) * 0.3}s`} repeatCount="indefinite" />
              </circle>
            )
          })}
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i * 60 * Math.PI) / 180
            const x1 = 40 + 16 * Math.cos(a)
            const y1 = 40 + 16 * Math.sin(a)
            return (
              <line key={i} x1="40" y1="40" x2={x1} y2={y1} stroke="rgba(60,100,180,0.12)" strokeWidth="0.5" strokeDasharray="2 3">
                <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="2s" repeatCount="indefinite" />
              </line>
            )
          })}
        </svg>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '4%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {['Prometheus', 'VM', 'Loki', 'PMM', 'Grafana', 'Glowroot'].map((c, i) => (
          <span
            key={c}
            style={{
              fontSize: 9,
              letterSpacing: 1,
              color: 'rgba(140,170,210,0.5)',
              padding: '2px 8px',
              border: '1px solid rgba(60,100,180,0.08)',
              borderRadius: 10,
              background: 'rgba(10,14,26,0.5)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: i === 4 ? '#faad14' : i === 5 ? '#ff4d4f' : '#52c41a',
                marginRight: 3,
                boxShadow: `0 0 3px ${i === 4 ? '#faad14' : i === 5 ? '#ff4d4f' : '#52c41a'}`,
              }}
            />
            {c}
          </span>
        ))}
      </div>

      <Card
        style={{
          width: 400,
          textAlign: 'center',
          borderRadius: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(60,100,180,0.12)',
          position: 'relative',
          zIndex: 2,
          background: 'rgba(12,16,30,0.94)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(60,100,180,0.12)',
        }}
      >
        <div
          aria-hidden
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 14,
            color: 'rgba(180,200,240,0.5)',
            fontSize: 10,
            letterSpacing: 2,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#ff4d4f',
              boxShadow: '0 0 8px #ff4d4f',
              animation: 'p-blink 1.2s ease-in-out infinite',
            }}
          />
          MONITORING PORTAL
        </div>
        <Title level={3} style={{ marginBottom: 4, color: '#e6f0ff', letterSpacing: 2 }}>
          统一监控门户
        </Title>
        <Text
          style={{
            display: 'block',
            marginBottom: 28,
            color: 'rgba(140,170,210,0.45)',
            fontSize: 12,
            letterSpacing: 4,
          }}
        >
          UNIFIED MONITORING PORTAL
        </Text>
        <Form onFinish={handleFinish} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input
              prefix={<UserOutlined style={{ color: '#ffffff', fontSize: 14 }} />}
              placeholder="用户名 / 工号"
              variant="outlined"
              styles={{
                input: { color: '#ffffff', background: '#0a0e1a' },
                root: { background: '#0a0e1a', borderColor: 'rgba(60,100,180,0.25)' },
              }}
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: '#ffffff', fontSize: 14 }} />}
              placeholder="密码"
              autoComplete="current-password"
              variant="outlined"
              styles={{
                input: { color: '#ffffff', background: '#0a0e1a' },
                root: { background: '#0a0e1a', borderColor: 'rgba(60,100,180,0.25)' },
              }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              icon={<LoginOutlined style={{ color: '#fff' }} />}
              style={{
                background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(22,119,255,0.35)',
                height: 42,
                fontSize: 14,
                letterSpacing: 4,
              }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
