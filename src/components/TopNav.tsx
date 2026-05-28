import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LifeBuoy,
  Sparkles,
  BookOpen,
  CalendarClock,
  CreditCard,
  Calculator,
  Shield,
  LogOut,
  UserCog,
  Search,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { WordMark } from './Logo'
import { useAuth } from '../lib/auth'
import { Avatar } from './Avatar'
import { NotificationsMenu } from './NotificationsMenu'
import { ThemeToggle } from './ThemeToggle'
import { useOutsideClick } from '../lib/useOutsideClick'
import { partnerAllows } from '../lib/permissions'
import type { PermissionKey } from '../lib/types'

type NavItem = {
  to: string
  label: string
  end?: boolean
  icon?: LucideIcon
  highlight?: boolean
  adminOnly?: boolean
  feature?: PermissionKey
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/app', label: 'Overview', end: true },
  { to: '/app/stories', label: 'Success stories', icon: Sparkles, feature: 'case_studies' },
  { to: '/app/services', label: 'Services', icon: CalendarClock, feature: 'service_requests' },
  { to: '/app/calculator', label: 'Savings calculator', icon: Calculator, highlight: true, feature: 'calculator' },
  { to: '/app/docs', label: 'Knowledge base', icon: BookOpen },
  { to: '/app/support', label: 'Support', icon: LifeBuoy, feature: 'zendesk' },
  { to: '/app/billing', label: 'Billing', icon: CreditCard, feature: 'billing' },
  { to: '/app/admin', label: 'Admin', icon: Shield, adminOnly: true },
]

const DESKTOP_ITEM_BASE =
  'relative inline-flex items-center gap-1.5 h-11 px-3 text-[13px] transition border-b-2'
const DESKTOP_ACTIVE = 'text-ink dark:text-ink-dark font-medium border-accent'
const DESKTOP_INACTIVE =
  'text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark border-transparent'

const MOBILE_ITEM_BASE = 'flex items-center gap-2 h-10 px-3 rounded-md text-[14px]'
const MOBILE_ACTIVE = 'bg-raised dark:bg-raised-dark text-ink dark:text-ink-dark font-medium'
const MOBILE_INACTIVE =
  'text-muted dark:text-muted-dark hover:bg-raised/60 dark:hover:bg-raised-dark/60'

function NavRow({
  item,
  variant,
  onClick,
}: {
  item: NavItem
  variant: 'desktop' | 'mobile'
  onClick?: () => void
}) {
  const Icon = item.icon
  const iconSize = variant === 'desktop' ? 13 : 14
  const [base, active, inactive] =
    variant === 'desktop'
      ? [DESKTOP_ITEM_BASE, DESKTOP_ACTIVE, DESKTOP_INACTIVE]
      : [MOBILE_ITEM_BASE, MOBILE_ACTIVE, MOBILE_INACTIVE]

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) => clsx(base, isActive ? active : inactive)}
    >
      {Icon && <Icon size={iconSize} strokeWidth={1.75} />}
      <span>{item.label}</span>
      {item.highlight && variant === 'desktop' && (
        <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
      )}
    </NavLink>
  )
}

export function TopNav() {
  const { user, logout, impersonate } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [userOpen, setUserOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)

  useOutsideClick(userRef, userOpen, () => setUserOpen(false))
  useOutsideClick(mobileRef, mobileOpen, () => setMobileOpen(false))

  useEffect(() => setMobileOpen(false), [pathname])

  if (!user) return null

  const navItems = PRIMARY_NAV.filter((item) => {
    if (item.adminOnly && user.role !== 'admin') return false
    if (item.feature && !partnerAllows(user, item.feature)) return false
    return true
  })
  const mainNavItems = navItems.filter((i) => !i.adminOnly)
  const adminNavItem = navItems.find((i) => i.adminOnly)

  return (
    <header
      ref={mobileRef}
      className="sticky top-0 z-30 bg-canvas/85 dark:bg-canvas-dark/85 backdrop-blur-md border-b border-line dark:border-line-dark"
    >
      <div className="h-14 px-4 md:px-8 flex items-center gap-4">
        <Link to="/app" className="shrink-0 flex items-center">
          <WordMark />
        </Link>

        <div className="hidden md:block flex-1 max-w-md relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint dark:text-faint-dark"
            aria-hidden
          />
          <input
            aria-label="Search portal"
            placeholder="Search stories, docs, tickets…"
            className="input pl-9 pr-16 h-9"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1" aria-hidden>
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <NotificationsMenu />
          <ThemeToggle />
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen((o) => !o)}
              className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-md border border-line dark:border-line-dark bg-surface dark:bg-surface-dark hover:bg-raised dark:hover:bg-raised-dark transition"
              aria-label="User menu"
              aria-expanded={userOpen}
            >
              <Avatar name={user.name} size="sm" />
              <div className="text-left hidden sm:block leading-tight">
                <div className="text-[12px] font-medium">{user.name.split(' ')[0]}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted dark:text-muted-dark">
                  {user.company}
                </div>
              </div>
              <ChevronDown size={12} className="text-faint dark:text-faint-dark hidden sm:block" />
            </button>
            {userOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 card shadow-lift p-1 animate-fade-up">
                <div className="px-3 py-2.5 border-b border-line dark:border-line-dark">
                  <div className="text-[13px] font-medium">{user.name}</div>
                  <div className="text-[11px] text-muted dark:text-muted-dark">{user.email}</div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark mt-1">
                    {user.company} · {user.role}
                  </div>
                </div>
                <div className="p-1">
                  {user.role === 'admin' && (
                    <Link
                      to="/app/admin"
                      onClick={() => setUserOpen(false)}
                      className="w-full text-left text-[13px] px-2 py-1.5 rounded-md hover:bg-raised dark:hover:bg-raised-dark flex items-center gap-2"
                    >
                      <Shield size={14} />
                      Admin panel
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      impersonate(user.role === 'admin' ? 'partner' : 'admin')
                      setUserOpen(false)
                      nav('/app')
                    }}
                    className="w-full text-left text-[13px] px-2 py-1.5 rounded-md hover:bg-raised dark:hover:bg-raised-dark flex items-center gap-2"
                  >
                    <UserCog size={14} />
                    Switch to {user.role === 'admin' ? 'Partner' : 'Admin'} view
                  </button>
                  <button
                    onClick={() => {
                      logout()
                      nav('/login')
                    }}
                    className="w-full text-left text-[13px] px-2 py-1.5 rounded-md hover:bg-raised dark:hover:bg-raised-dark flex items-center gap-2 text-danger"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded-md border border-line dark:border-line-dark text-muted dark:text-muted-dark"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
        </div>
      </div>

      <nav className="hidden md:block border-t border-line/60 dark:border-line-dark/60">
        <div className="px-4 md:px-8">
          <ul className="flex items-center gap-1 -mb-px overflow-x-auto no-scrollbar">
            {mainNavItems.map((item) => (
              <li key={item.to} className="shrink-0">
                <NavRow item={item} variant="desktop" />
              </li>
            ))}
            {adminNavItem && (
              <li className="shrink-0 ml-auto">
                <NavRow item={adminNavItem} variant="desktop" />
              </li>
            )}
          </ul>
        </div>
      </nav>

      {mobileOpen && (
        <nav className="md:hidden border-t border-line dark:border-line-dark bg-surface dark:bg-surface-dark animate-fade-up">
          <ul className="px-3 py-2 space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavRow item={item} variant="mobile" onClick={() => setMobileOpen(false)} />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
