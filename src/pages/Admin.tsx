import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import clsx from 'clsx'
import AdminCalculator from './admin/AdminCalculator'
import AdminStories from './admin/AdminStories'
import AdminUsers from './admin/AdminUsers'
import { PageHeader } from '../components/PageHeader'
import { Shield } from 'lucide-react'

const TABS = [
  { to: 'calculator', label: 'Calculator rules' },
  { to: 'stories', label: 'Success stories' },
  { to: 'users', label: 'Users' },
]

export default function Admin() {
  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Shield size={11} /> Admin · internal only
          </span>
        }
        title="Workspace controls"
        description="Manage the calculator data model, publish success stories, and oversee partner accounts."
      />
      <nav className="flex items-center gap-1 mb-5 border-b border-line dark:border-line-dark">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              clsx(
                'relative h-9 px-3 text-[13px] transition',
                isActive
                  ? 'text-ink dark:text-ink-dark font-medium'
                  : 'text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark',
              )
            }
          >
            {({ isActive }) => (
              <>
                {t.label}
                {isActive && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-ink dark:bg-ink-dark" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<Navigate to="calculator" replace />} />
        <Route path="calculator" element={<AdminCalculator />} />
        <Route path="stories" element={<AdminStories />} />
        <Route path="users" element={<AdminUsers />} />
      </Routes>
    </div>
  )
}
