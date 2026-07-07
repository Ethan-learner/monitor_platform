import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1009,
    strictPort: true,
    proxy: {
      '/api/proxy/grafana': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/proxy\/grafana/, '/grafana'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) {
              proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
            }
          })
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['x-frame-options']
            if (proxyRes.headers['content-security-policy']) {
              proxyRes.headers['content-security-policy'] =
                proxyRes.headers['content-security-policy'].replace(/frame-ancestors[^;]*;?/g, '')
            }
            if (proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location
                .replace(/^https?:\/\/172\.16\.10\.99(\/grafana)?/, '/api/proxy/grafana')
                .replace(/^\/grafana/, '/api/proxy/grafana')
            }
          })
        },
      },
      '/api/proxy/pmm': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/proxy\/pmm/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) {
              proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
            }
          })
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['x-frame-options']
            if (proxyRes.headers['content-security-policy']) {
              proxyRes.headers['content-security-policy'] =
                proxyRes.headers['content-security-policy'].replace(/frame-ancestors[^;]*;?/g, '')
            }
            if (proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location
                .replace(/^https?:\/\/172\.16\.10\.99/, '/api/proxy/pmm')
                .replace(/^\/(?!api\/proxy)/, '/api/proxy/pmm/')
            }
          })
        },
      },
      '/v1': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) {
              proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
            }
          })
        },
      },
      '/graph': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) {
              proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
            }
          })
        },
      },
      '/grafana': {
        target: 'https://172.16.10.99',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://172.16.10.99')
            if (req.headers['referer']) {
              proxyReq.setHeader('referer', req.headers['referer'].replace(/localhost:\d+/, '172.16.10.99'))
            }
          })
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['x-frame-options']
          })
        },
      },
    },
  },
})
