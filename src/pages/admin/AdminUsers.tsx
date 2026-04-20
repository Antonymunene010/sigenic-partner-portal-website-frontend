import { useState } from 'react'
import { Ban, CheckCircle2, Shield, User as UserIcon } from 'lucide-react'
import { load, save } from '../../lib/storage'
import type { User } from '../../lib/types'
import { seedUsers } from '../../lib/seed'
import { Badge } from '../../components/Badge'
import { fmtDate } from '../../lib/format'

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>(() => load<User[]>('users', seedUsers))

  const persist = (next: User[]) => {
    save('users', next)
    setUsers(next)
  }

  const toggleActive = (id: string) =>
    persist(users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)))

  const toggleRole = (id: string) =>
    persist(users.map((u) => (u.id === id ? { ...u, role: u.role === 'admin' ? 'partner' : 'admin' } : u)))

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[17px] font-semibold tracking-tight">Users</h2>
        <p className="text-[12.5px] text-muted dark:text-muted-dark mt-0.5">
          Partner-tier accounts, role assignments, and activation status.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={users.length} />
        <Stat label="Active" value={users.filter((u) => u.active).length} />
        <Stat label="Partner" value={users.filter((u) => u.role === 'partner').length} />
        <Stat label="Admin" value={users.filter((u) => u.role === 'admin').length} />
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th className="w-48">Email</th>
              <th className="w-44">Company</th>
              <th className="w-24">Role</th>
              <th className="w-24">Status</th>
              <th className="w-28">Joined</th>
              <th className="w-40 text-right pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-sm bg-ink text-canvas dark:bg-ink-dark dark:text-canvas-dark text-[10px] font-medium flex items-center justify-center">
                      {u.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium">{u.name}</div>
                      <div className="text-[10.5px] font-mono text-faint dark:text-faint-dark">{u.id}</div>
                    </div>
                  </div>
                </td>
                <td className="text-[12px] text-muted dark:text-muted-dark">{u.email}</td>
                <td className="text-[12.5px]">{u.company}</td>
                <td>
                  <Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>
                    {u.role === 'admin' ? <Shield size={10} /> : <UserIcon size={10} />}
                    {u.role}
                  </Badge>
                </td>
                <td>
                  <Badge tone={u.active ? 'paid' : 'closed'} dot>{u.active ? 'active' : 'off'}</Badge>
                </td>
                <td className="text-[11.5px] font-mono text-muted dark:text-muted-dark">{fmtDate(u.createdAt)}</td>
                <td className="text-right pr-3">
                  <div className="inline-flex gap-1">
                    <button onClick={() => toggleRole(u.id)} className="btn-outline h-7 text-[11px]">
                      Make {u.role === 'admin' ? 'partner' : 'admin'}
                    </button>
                    <button
                      onClick={() => toggleActive(u.id)}
                      className={`h-7 text-[11px] ${u.active ? 'btn-outline text-danger border-danger/20 hover:bg-danger/5' : 'btn-outline text-success border-success/20 hover:bg-success/5'}`}
                    >
                      {u.active ? <><Ban size={11} /> Deactivate</> : <><CheckCircle2 size={11} /> Activate</>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="stat-label">{label}</div>
      <div className="mt-2 text-[26px] font-semibold tracking-tightest num leading-none">{value}</div>
    </div>
  )
}
