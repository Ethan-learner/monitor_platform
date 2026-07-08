import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function hideFrameHeaders(proxyRes: any) {
  delete proxyRes.headers['x-frame-options']
  if (proxyRes.headers['content-security-policy']) {
    proxyRes.headers['content-security-policy'] =
      proxyRes.headers['content-security-policy'].replace(/frame-ancestors[^;]*;?/g, '')
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1009,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/grafana': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
          })
          proxy.on('proxyRes', hideFrameHeaders)
        },
      },
      '/pmm': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/pmm/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
          })
          proxy.on('proxyRes', (proxyRes) => {
            hideFrameHeaders(proxyRes)
            if (proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location
                .replace(/^https?:\/\/172\.16\.10\.99/, '/pmm')
                .replace(/^\/(?!api\/proxy)/, '/pmm/')
            }
          })
        },
      },
      '/pmm-ui': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            proxyReq.setHeader('Authorization', 'Basic ' + Buffer.from('admin:123456').toString('base64'))
            if (req.headers['referer']) proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
          })
          proxy.on('proxyRes', hideFrameHeaders)
        },
      },
      '/graph': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
          })
          proxy.on('proxyRes', hideFrameHeaders)
        },
      },
      '/v1': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
          })
          proxy.on('proxyRes', hideFrameHeaders)
        },
      },
      '/glowroot': {
        target: 'https://172.16.10.99:4020',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/glowroot/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99:4020')
            if (req.headers['referer']) proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
          })
          proxy.on('proxyRes', hideFrameHeaders)
        },
      },
      '/backend': {
        target: 'https://172.16.10.99:4020',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'https://172.16.10.99:4020',
        changeOrigin: true,
        secure: false,
      },
      '/alertmanager/': {
        target: 'http://172.16.10.27:9093',
        changeOrigin: true,
      },
      '/prometheus': {
        target: 'http://172.16.10.27:9090',
        changeOrigin: true,
        configure: (proxy) => { proxy.on('proxyRes', hideFrameHeaders) },
      },
      '/loki': {
        target: 'http://172.16.10.27:3100',
        changeOrigin: true,
        configure: (proxy) => { proxy.on('proxyRes', hideFrameHeaders) },
      },
      '/vmselect': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => { proxy.on('proxyRes', hideFrameHeaders) },
      },
    },
  },
})
