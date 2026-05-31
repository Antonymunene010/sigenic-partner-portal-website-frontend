import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { useData, useLookups } from '../../lib/data'
import { can } from '../../lib/permissions'
import { PageHeader } from '../../components/PageHeader'
import { CrudResource } from '../../components/CrudResource'
import { Badge } from '../../components/Badge'
import { chipClass } from '../../components/ui'
import { boolTone } from '../../lib/constants'
import { departmentOptions, processOptions } from '../../lib/options'
import type { Department, Machine, Process } from '../../lib/types'

type Tab = 'departments' | 'processes' | 'machines'

export default function AdminMasterData() {
  const { user } = useAuth()
  const { departments, processes, machines, refresh } = useData()
  const lookups = useLookups()
  const [tab, setTab] = useState<Tab>('departments')
  const canManage = can(user, 'manage_master_data')

  const deptOptions = departmentOptions(departments)
  const procOptions = processOptions(processes)
  const activeBadge = (a: boolean) => <Badge tone={boolTone(a)}>{a ? 'active' : 'inactive'}</Badge>

  return (
    <div>
      <PageHeader eyebrow="Master data" title="Machines, processes & departments" description="The operational taxonomy that powers the calculator and request tagging. Internal management only." />

      <div className="flex items-center gap-1 mb-5">
        {(['departments', 'processes', 'machines'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${chipClass(tab === t)} capitalize`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'departments' && (
        <CrudResource<Department>
          title="Departments"
          resource="departments"
          idPrefix="dep"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={departments}
          refresh={refresh}
          columns={[
            { key: 'name', header: 'Name', render: (d) => <span className="font-medium">{d.name}</span> },
            { key: 'code', header: 'Code', render: (d) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{d.code}</span> },
            { key: 'active', header: 'Status', render: (d) => activeBadge(d.active) },
          ]}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'code', label: 'Code' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'processes' && (
        <CrudResource<Process>
          title="Processes"
          resource="processes"
          idPrefix="proc"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={processes}
          refresh={refresh}
          columns={[
            { key: 'processName', header: 'Process', render: (p) => <span className="font-medium">{p.processName}</span> },
            { key: 'department', header: 'Department', sortAccessor: (p) => lookups.departmentName(p.departmentId), render: (p) => lookups.departmentName(p.departmentId) },
            { key: 'code', header: 'Code', sortAccessor: (p) => p.processCode, render: (p) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{p.processCode}</span> },
            { key: 'active', header: 'Status', render: (p) => activeBadge(p.active) },
          ]}
          fields={[
            { key: 'processName', label: 'Process name', required: true },
            { key: 'departmentId', label: 'Department', type: 'select', options: deptOptions, required: true },
            { key: 'processCode', label: 'Code' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'machines' && (
        <CrudResource<Machine>
          title="Machines"
          resource="machines"
          idPrefix="mac"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={machines}
          refresh={refresh}
          columns={[
            { key: 'machineName', header: 'Machine', render: (m) => <div><div className="font-medium">{m.machineName}</div><div className="text-xs text-muted dark:text-muted-dark">{[m.vendor, m.model].filter(Boolean).join(' · ')}</div></div> },
            { key: 'department', header: 'Department', sortAccessor: (m) => lookups.departmentName(m.departmentId), render: (m) => lookups.departmentName(m.departmentId) },
            { key: 'category', header: 'Category', sortAccessor: (m) => m.machineCategory, render: (m) => <span className="text-muted dark:text-muted-dark">{m.machineCategory}</span> },
            { key: 'active', header: 'Status', render: (m) => activeBadge(m.active) },
          ]}
          fields={[
            { key: 'machineName', label: 'Machine name', required: true },
            { key: 'machineCode', label: 'Code' },
            { key: 'departmentId', label: 'Department', type: 'select', options: deptOptions, required: true },
            { key: 'processId', label: 'Process', type: 'select', options: procOptions },
            { key: 'machineCategory', label: 'Category' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'model', label: 'Model' },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}
    </div>
  )
}
