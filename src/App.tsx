import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { NotificationsProvider } from './lib/notifications'
import { seedIfNeeded } from './lib/seed'
import { bootstrapData } from './lib/api'
import { WordMark } from './components/Logo'

import Login from './pages/Login'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { FeatureGate } from './components/FeatureGate'

import Dashboard from './pages/Dashboard'
import Support from './pages/Support'
import TicketDetail from './pages/TicketDetail'
import NewTicket from './pages/NewTicket'
import Stories from './pages/Stories'
import StoryDetail from './pages/StoryDetail'
import Docs from './pages/Docs'
import DocDetail from './pages/DocDetail'
import Services from './pages/Services'
import Billing from './pages/Billing'
import Calculator from './pages/Calculator'
import Admin from './pages/Admin'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedIfNeeded()
    bootstrapData()
      .catch(() => {
        /* offline/demo mode keeps using local seed data */
      })
      .finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark flex items-center justify-center">
        <div className="flex items-center gap-3 text-[12px] font-mono uppercase tracking-[0.12em] text-muted dark:text-muted-dark">
          <WordMark /> Loading portal data…
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="support" element={<FeatureGate feature="zendesk"><Support /></FeatureGate>} />
              <Route path="support/new" element={<FeatureGate feature="zendesk"><NewTicket /></FeatureGate>} />
              <Route path="support/:id" element={<FeatureGate feature="zendesk"><TicketDetail /></FeatureGate>} />
              <Route path="stories" element={<FeatureGate feature="case_studies"><Stories /></FeatureGate>} />
              <Route path="stories/:slug" element={<FeatureGate feature="case_studies"><StoryDetail /></FeatureGate>} />
              <Route path="docs" element={<Docs />} />
              <Route path="docs/:slug" element={<DocDetail />} />
              <Route path="services" element={<FeatureGate feature="service_requests"><Services /></FeatureGate>} />
              <Route path="demo" element={<Navigate to="/app/services" replace />} />
              <Route path="billing" element={<FeatureGate feature="billing"><Billing /></FeatureGate>} />
              <Route path="calculator" element={<FeatureGate feature="calculator"><Calculator /></FeatureGate>} />
              <Route
                path="admin/*"
                element={
                  <ProtectedRoute role="admin">
                    <Admin />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
