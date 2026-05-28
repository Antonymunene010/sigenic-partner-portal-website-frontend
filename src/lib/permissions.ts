import { seedOps } from './seed'
import { load } from './storage'
import type { OpsConfig, PermissionKey, User } from './types'

export function partnerAllows(user: User | null | undefined, feature: PermissionKey): boolean {
  if (!user || user.role === 'admin') return true
  const ops = load<OpsConfig>('ops', seedOps)
  const partner = ops.partners.find((item) => item.name.toLowerCase() === user.company.toLowerCase())
  if (!partner || partner.status === 'inactive') return false
  return partner.permissions[feature] ?? true
}

export function partnerStatusLabel(user: User | null | undefined): string {
  if (!user || user.role === 'admin') return 'Internal'
  const ops = load<OpsConfig>('ops', seedOps)
  const partner = ops.partners.find((item) => item.name.toLowerCase() === user.company.toLowerCase())
  if (!partner) return 'Unmanaged partner'
  return `${partner.tier} · ${partner.status}`
}
