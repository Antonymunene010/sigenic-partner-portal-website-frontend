import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { seedIfNeeded } from './lib/seed'

import Login from './pages/Login'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'

import Dashboard from './pages/Dashboard'
import Support from './pages/Support'
import TicketDetail from './pages/TicketDetail'
import NewTicket from './pages/NewTicket'
import Stories from './pages/Stories'
import StoryDetail from './pages/StoryDetail'
import Docs from './pages/Docs'
import DocDetail from './pages/DocDetail'
import Demo from './pages/Demo'
import Billing from './pages/Billing'
import Calculator from './pages/Calculator'
import Admin from './pages/Admin'

export default function App() {
  useEffect(() => {
    seedIfNeeded()
  }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
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
            <Route path="support" element={<Support />} />
            <Route path="support/new" element={<NewTicket />} />
            <Route path="support/:id" element={<TicketDetail />} />
            <Route path="stories" element={<Stories />} />
            <Route path="stories/:slug" element={<StoryDetail />} />
            <Route path="docs" element={<Docs />} />
            <Route path="docs/:slug" element={<DocDetail />} />
            <Route path="demo" element={<Demo />} />
            <Route path="billing" element={<Billing />} />
            <Route path="calculator" element={<Calculator />} />
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
      </AuthProvider>
    </ThemeProvider>
  )
}
