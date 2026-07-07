import { Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Spin } from 'antd'
import { useAuthStore } from '../store/authStore'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, init } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    if (loading && !isAuthenticated) init()
  }, [loading, isAuthenticated, init])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
