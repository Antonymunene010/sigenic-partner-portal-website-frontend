import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { can, isInternal, type Capability } from '../lib/permissions'

export function ProtectedRoute({
  children,
  internal,
  cap,
}: {
  children: ReactNode
  internal?: boolean
  cap?: Capability
}) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (internal && !isInternal(user)) return <Navigate to="/app" replace />
  if (cap && !can(user, cap)) return <Navigate to="/app" replace />
  return <>{children}</>
}
