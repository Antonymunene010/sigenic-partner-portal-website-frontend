import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calculator, BookOpen, Inbox, Building2, Users, UserPlus, CreditCard,
  SlidersHorizontal, ListChecks, Megaphone, ScrollText, BarChart3,
  Sparkles, ChevronDown, LogOut, UserCircle, Menu, X, ExternalLink, CalendarClock, Flame, History,
} from 'lucide-react'
import clsx from 'clsx'
import { WordMark } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { NotificationsMenu } from './NotificationsMenu'
import { Avatar } from './Avatar'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { useOutsideClick } from '../lib/useOutsideClick'
import { can, isInternal, roleLabel, type Capability } from '../lib/permissions'
import type { User } from '../lib/types'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  cap?: Capability
  show?: (u: User) => boolean
}

const PORTAL_NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/calculator', label: 'Risk Calculator', icon: Calculator, cap: 'use_full_calculator' },
  { to: '/app/calculator-history', label: 'Calc History', icon: History, cap: 'view_calculator_history' },
  { to: '/app/knowledge', label: 'Knowledge Base', icon: BookOpen, cap: 'access_knowledge_base' },
  { to: '/app/stories', label: 'Success Stories', icon: Sparkles, cap: 'view_success_stories' },
  { to: '/app/requests', label: 'Requests', icon: Inbox, cap: 'view_request_list' },
  { to: '/app/company', label: 'Company Profile', icon: Building2, cap: 'view_company_profile' },
  { to: '/app/users', label: 'Team', icon: Users, cap: 'manage_company_users' },
  { to: '/app/billing', label: 'Billing', icon: CreditCard, show: (u) => u.userType === 'customer' },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/admin/companies', label: 'Partners', icon: Building2, cap: 'view_all_companies' },
  { to: '/app/admin/users', label: 'Internal Users', icon: Users, cap: 'manage_internal_users' },
  { to: '/app/admin/signups', label: 'Sign-up Requests', icon: UserPlus, cap: 'view_pending_signups' },
  { to: '/app/admin/calculator-config', label: 'Calculator Config', icon: SlidersHorizontal, cap: 'manage_scoring' },
  { to: '/app/admin/calculator-runs', label: 'Calculator Leads', icon: Flame, cap: 'view_calculator_runs' },
  { to: '/app/admin/request-config', label: 'Request Config', icon: ListChecks, cap: 'manage_request_config' },
  { to: '/app/admin/requests', label: 'Request Oversight', icon: Inbox, cap: 'view_ticket_oversight' },
  { to: '/app/admin/knowledge', label: 'Knowledge', icon: BookOpen, cap: 'manage_knowledge' },
  { to: '/app/admin/stories', label: 'Success Stories', icon: Sparkles, cap: 'manage_success_stories' },
  // Internal oversight roles (e.g. support engineers) can't manage stories but still
  // browse them via the read-only page; managers reach the same content above.
  { to: '/app/stories', label: 'Success Stories', icon: Sparkles, cap: 'view_success_stories', show: (u) => !can(u, 'manage_success_stories') },
  { to: '/app/admin/announcements', label: 'Announcements', icon: Megaphone, cap: 'manage_announcements' },
  { to: '/app/admin/audit', label: 'Audit Log', icon: ScrollText, cap: 'view_audit_logs' },
  { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3, cap: 'view_analytics' },
  { to: '/app/calculator', label: 'Risk Calculator', icon: Calculator, cap: 'use_full_calculator' },
]

function navFor(user: User): NavItem[] {
  const items = isInternal(user) ? ADMIN_NAV : PORTAL_NAV
  return items.filter((i) => (i.cap ? can(user, i.cap) : true) && (i.show ? i.show(user) : true))
}

export function AppLayout() {
  const { user } = useAuth()
  const { company, error, refresh } = useData()
  const [mobileOpen, setMobileOpen] = useState(false)
  if (!user) return null
  const items = navFor(user)

  const SidebarContent = (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-3 h-9 rounded-md text-sm transition',
                isActive
                  ? 'bg-accent/12 text-emphasis font-medium'
                  : 'text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark hover:bg-raised dark:hover:bg-raised-dark',
              )
            }
          >
            <Icon size={15} />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-canvas-dark">
      {/* Header */}
      <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 border-b border-line dark:border-line-dark bg-canvas/90 dark:bg-canvas-dark/90 backdrop-blur">
        <button className="lg:hidden btn-ghost px-2" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu">
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <Link to="/app" className="shrink-0">
          <WordMark />
        </Link>
        <div className="ml-2 hidden sm:flex items-center gap-2 text-xs text-muted dark:text-muted-dark">
          <span className="text-faint">/</span>
          <span className="font-medium text-ink dark:text-ink-dark">{company?.companyName ?? 'Sigenic'}</span>
          {isInternal(user) && <span className="badge border-accent-dim text-accent-ink bg-accent">internal</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isInternal(user) && (
            <Link to="/app/requests/new?type=demo" className="btn-accent">
              <CalendarClock size={15} aria-hidden />
              <span className="sr-only sm:not-sr-only">Request a demo</span>
            </Link>
          )}
          <NotificationsMenu />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block w-60 shrink-0 border-r border-line dark:border-line-dark">
          <div className="sticky top-14">{SidebarContent}</div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-20" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute left-0 top-14 bottom-0 w-64 bg-canvas dark:bg-canvas-dark border-r border-line dark:border-line-dark" onClick={(e) => e.stopPropagation()}>
              {SidebarContent}
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0">
          <div className="px-4 md:px-8 py-6 md:py-8">
            <div className="max-w-[1180px] mx-auto animate-fade-up">
              {error && (
                <div className="mb-5 flex items-center justify-between gap-3 rounded-md border border-line dark:border-line-dark bg-raised dark:bg-raised-dark px-4 py-3 text-sm">
                  <span className="text-danger">Couldn't load the latest data — some sections may be empty or out of date.</span>
                  <button className="btn-ghost text-xs shrink-0" onClick={() => refresh()}>Retry</button>
                </div>
              )}
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function UserMenu({ user }: { user: User }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-md hover:bg-raised dark:hover:bg-raised-dark transition">
        <Avatar name={user.fullName} variant="accent" />
        <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">{user.fullName}</span>
        <ChevronDown size={13} className="text-faint" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 card shadow-lift p-0 animate-fade-up overflow-hidden">
          <div className="px-3 py-2.5 border-b border-line dark:border-line-dark">
            <div className="text-sm font-medium truncate">{user.fullName}</div>
            <div className="text-xs text-muted dark:text-muted-dark truncate">{user.email}</div>
            <div className="mt-1.5 badge border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised dark:bg-raised-dark">{roleLabel(user.role)}</div>
          </div>
          <button onClick={() => { setOpen(false); navigate('/app/account') }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-raised dark:hover:bg-raised-dark text-left">
            <UserCircle size={15} /> Account
          </button>
          <a href="/" className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-raised dark:hover:bg-raised-dark text-left">
            <ExternalLink size={15} /> Public site
          </a>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-raised dark:hover:bg-raised-dark text-left border-t border-line dark:border-line-dark text-danger">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
