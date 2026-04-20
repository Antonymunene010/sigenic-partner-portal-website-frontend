import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: 'admin' | 'partner' }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/app" replace />
  return <>{children}</>
}
