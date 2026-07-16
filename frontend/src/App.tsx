import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import MainLayout from './components/Layout/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Overview from './pages/Overview'
import Prometheus from './pages/Prometheus'
import NewRules from './pages/NewRules'
import RulesList from './pages/RulesList'
import AlertHistory from './pages/AlertHistory'
import SilenceList from './pages/SilenceList'
import SilenceNew from './pages/SilenceNew'
import WebhookEvents from './pages/WebhookEvents'
import StrategyConfig from './pages/StrategyConfig'
import Profile from './pages/Profile'
import UserMgmt from './pages/UserMgmt'
import LoginLogs from './pages/LoginLogs'
import NotFound from './pages/NotFound'
import { useAuthStore } from './store/authStore'
import { roleMenus, type MenuItem, nativeMenuKeys } from './config/menus'

function findItemByKey(items: MenuItem[], key: string): MenuItem | undefined {
  for (const item of items) {
    if (item.key === key) return item
    if (item.children) {
      const found = findItemByKey(item.children, key)
      if (found) return found
    }
  }
}

function DashboardRoute() {
  const { menuKey } = useParams<{ menuKey: string }>()
  const user = useAuthStore((s) => s.user)
  const menus = roleMenus[user?.role || 'dev']?.menus || []
  const item = findItemByKey(menus, menuKey || '')
  if (!item) return <NotFound />
  if (item.native) {
    if (item.key === nativeMenuKeys.overview) return <Overview />
    if (item.key === nativeMenuKeys.newRules) return <NewRules />
    if (item.key === nativeMenuKeys.rulesList) return <RulesList />
    if (item.key === nativeMenuKeys.alertHistory) return <AlertHistory />
    if (item.key === 'alertmanager-silences') return <SilenceList />
    if (item.key === 'webhook-events') return <WebhookEvents />
    if (item.key === 'strategy-config') return <StrategyConfig />
    if (item.key === 'prometheus') return <Prometheus />
    if (item.key === 'profile') return <Profile />
    if (item.key === 'user-mgmt') return <UserMgmt />
    if (item.key === 'login-logs') return <LoginLogs />
  }
  return <Dashboard url={item.url || ''} title={item.label} hideHeader={item.hideHeader} />
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path=":menuKey" element={<DashboardRoute />} />
            <Route path="silence-new" element={<SilenceNew />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
