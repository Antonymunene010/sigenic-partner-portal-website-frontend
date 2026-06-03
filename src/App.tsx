import { Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import { AuthProvider } from './lib/auth'
import { DataProvider } from './lib/data'
import { ToastProvider } from './components/ui'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PublicLayout } from './components/PublicLayout'
import { AppLayout } from './components/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import PublicStories from './pages/PublicStories'
import StoryDetail from './pages/StoryDetail'
import Contact from './pages/Contact'
import PublicCalculator from './pages/PublicCalculator'

import Dashboard from './pages/Dashboard'
import Calculator from './pages/Calculator'
import KnowledgeBase from './pages/KnowledgeBase'
import ArticleDetail from './pages/ArticleDetail'
import Stories from './pages/Stories'
import StoryView from './pages/StoryView'
import RequestList from './pages/RequestList'
import NewRequest from './pages/NewRequest'
import RequestDetail from './pages/RequestDetail'
import CompanyProfile from './pages/CompanyProfile'
import UserManagement from './pages/UserManagement'
import Billing from './pages/Billing'
import Account from './pages/Account'

import AdminCompanies from './pages/admin/AdminCompanies'
import AdminInternalUsers from './pages/admin/AdminInternalUsers'
import AdminMasterData from './pages/admin/AdminMasterData'
import AdminScoring from './pages/admin/AdminScoring'
import AdminRequests from './pages/admin/AdminRequests'
import AdminKnowledge from './pages/admin/AdminKnowledge'
import AdminStories from './pages/admin/AdminStories'
import AdminAnnouncements from './pages/admin/AdminAnnouncements'
import AdminAudit from './pages/admin/AdminAudit'
import AdminAnalytics from './pages/admin/AdminAnalytics'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <ToastProvider>
              <Routes>
                {/* Public marketing site */}
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Landing />} />
                  <Route path="/stories" element={<PublicStories />} />
                  <Route path="/stories/:slug" element={<StoryDetail />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/calculator" element={<PublicCalculator />} />
                </Route>

                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Authenticated portal + internal admin */}
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="calculator" element={<ProtectedRoute cap="use_full_calculator"><Calculator /></ProtectedRoute>} />
                  <Route path="knowledge" element={<ProtectedRoute cap="access_knowledge_base"><KnowledgeBase /></ProtectedRoute>} />
                  <Route path="knowledge/:slug" element={<ProtectedRoute cap="access_knowledge_base"><ArticleDetail /></ProtectedRoute>} />
                  <Route path="stories" element={<ProtectedRoute cap="view_success_stories"><Stories /></ProtectedRoute>} />
                  <Route path="stories/:slug" element={<ProtectedRoute cap="view_success_stories"><StoryView /></ProtectedRoute>} />
                  <Route path="requests" element={<ProtectedRoute cap="view_request_list"><RequestList /></ProtectedRoute>} />
                  <Route path="requests/new" element={<ProtectedRoute cap="submit_consultation_request"><NewRequest /></ProtectedRoute>} />
                  <Route path="requests/:id" element={<ProtectedRoute cap="view_request_list"><RequestDetail /></ProtectedRoute>} />
                  <Route path="company" element={<ProtectedRoute cap="view_company_profile"><CompanyProfile /></ProtectedRoute>} />
                  <Route path="users" element={<ProtectedRoute cap="manage_company_users"><UserManagement /></ProtectedRoute>} />
                  <Route path="billing" element={<Billing />} />
                  <Route path="account" element={<Account />} />

                  {/* Internal admin */}
                  <Route path="admin/companies" element={<ProtectedRoute internal cap="view_all_companies"><AdminCompanies /></ProtectedRoute>} />
                  <Route path="admin/users" element={<ProtectedRoute internal cap="manage_internal_users"><AdminInternalUsers /></ProtectedRoute>} />
                  <Route path="admin/master-data" element={<ProtectedRoute internal cap="view_master_data"><AdminMasterData /></ProtectedRoute>} />
                  <Route path="admin/scoring" element={<ProtectedRoute internal cap="manage_scoring"><AdminScoring /></ProtectedRoute>} />
                  <Route path="admin/requests" element={<ProtectedRoute internal cap="view_ticket_oversight"><AdminRequests /></ProtectedRoute>} />
                  <Route path="admin/knowledge" element={<ProtectedRoute internal cap="manage_knowledge"><AdminKnowledge /></ProtectedRoute>} />
                  <Route path="admin/stories" element={<ProtectedRoute internal cap="manage_success_stories"><AdminStories /></ProtectedRoute>} />
                  <Route path="admin/announcements" element={<ProtectedRoute internal cap="manage_announcements"><AdminAnnouncements /></ProtectedRoute>} />
                  <Route path="admin/audit" element={<ProtectedRoute internal cap="view_audit_logs"><AdminAudit /></ProtectedRoute>} />
                  <Route path="admin/analytics" element={<ProtectedRoute internal cap="view_analytics"><AdminAnalytics /></ProtectedRoute>} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ToastProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
