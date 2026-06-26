import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { useData, useLookups } from '../../lib/data'
import { can } from '../../lib/permissions'
import { PageHeader } from '../../components/PageHeader'
import { CrudResource } from '../../components/CrudResource'
import { Badge } from '../../components/Badge'
import { chipClass } from '../../components/ui'
import { boolTone, OWNER_TEAMS } from '../../lib/constants'
import { requestDepartmentOptions, requestProcessOptions } from '../../lib/options'
import type { RequestTypeDef, RequestDepartment, RequestProcess, RequestMachine } from '../../lib/types'

// The service-request intake taxonomy: request types + the department/process/machine
// pickers on the request form. Super-admin-only and DELIBERATELY SEPARATE from the
// calculator's master data — same CRUD shell as AdminCalculatorConfig, different tables,
// its own capability (manage_request_config).
type Tab = 'types' | 'departments' | 'processes' | 'machines'
const TABS: Tab[] = ['types', 'departments', 'processes', 'machines']

export default function AdminRequestConfig() {
  const { user } = useAuth()
  const { requestTypes, requestDepartments, requestProcesses, requestMachines, refresh } = useData()
  const lookups = useLookups()
  const [tab, setTab] = useState<Tab>('types')
  const canManage = can(user, 'manage_request_config')

  const deptOptions = requestDepartmentOptions(requestDepartments)
  const procOptions = requestProcessOptions(requestProcesses)
  const activeBadge = (a: boolean) => <Badge tone={boolTone(a)}>{a ? 'active' : 'inactive'}</Badge>

  const chip = (t: Tab) => (
    <button key={t} onClick={() => setTab(t)} className={`${chipClass(tab === t)} capitalize`}>
      {t}
    </button>
  )

  return (
    <div>
      <PageHeader eyebrow="Requests" title="Request Config" description="The request types and the department / process / machine options shown on the service-request form. Configured independently of the risk calculator. Super-admin only." />

      <div className="flex items-center gap-1 mb-5 flex-wrap">{TABS.map(chip)}</div>

      {tab === 'types' && (
        <CrudResource<RequestTypeDef>
          title="Request types"
          description="The options a user picks when raising a request. The slug is stored on each request; the owner team routes it."
          resource="request-types"
          idPrefix="rt"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={requestTypes}
          refresh={refresh}
          columns={[
            { key: 'label', header: 'Label', render: (t) => <span className="font-medium">{t.label}</span> },
            { key: 'slug', header: 'Slug', render: (t) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{t.slug}</span> },
            { key: 'ownerTeam', header: 'Owner team', render: (t) => <span className="capitalize text-muted dark:text-muted-dark">{t.ownerTeam}</span> },
            { key: 'sortOrder', header: 'Order', render: (t) => <span className="num">{t.sortOrder}</span> },
            { key: 'active', header: 'Status', render: (t) => activeBadge(t.active) },
          ]}
          fields={[
            { key: 'label', label: 'Label', required: true },
            { key: 'slug', label: 'Slug', required: true, help: 'Stable id stored on requests. Built-in slugs (support / demo / consultation) carry special behavior — avoid renaming them.' },
            { key: 'ownerTeam', label: 'Owner team', type: 'select', options: OWNER_TEAMS, required: true, help: 'Which team new requests of this type route to.' },
            { key: 'blurb', label: 'Blurb', type: 'textarea', help: 'Short helper text shown under the type on the form.' },
            { key: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'departments' && (
        <CrudResource<RequestDepartment>
          title="Departments"
          description="Departments shown on the request form — separate from the calculator's departments."
          resource="request-departments"
          idPrefix="rdep"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={requestDepartments}
          refresh={refresh}
          columns={[
            { key: 'name', header: 'Name', render: (d) => <span className="font-medium">{d.name}</span> },
            { key: 'code', header: 'Code', render: (d) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{d.code}</span> },
            { key: 'sortOrder', header: 'Order', render: (d) => <span className="num">{d.sortOrder}</span> },
            { key: 'active', header: 'Status', render: (d) => activeBadge(d.active) },
          ]}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'code', label: 'Code' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'processes' && (
        <CrudResource<RequestProcess>
          title="Processes"
          resource="request-processes"
          idPrefix="rproc"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={requestProcesses}
          refresh={refresh}
          columns={[
            { key: 'processName', header: 'Process', render: (p) => <span className="font-medium">{p.processName}</span> },
            { key: 'department', header: 'Department', sortAccessor: (p) => lookups.requestDepartmentName(p.requestDepartmentId), render: (p) => lookups.requestDepartmentName(p.requestDepartmentId) },
            { key: 'code', header: 'Code', sortAccessor: (p) => p.processCode, render: (p) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{p.processCode}</span> },
            { key: 'active', header: 'Status', render: (p) => activeBadge(p.active) },
          ]}
          fields={[
            { key: 'processName', label: 'Process name', required: true },
            { key: 'requestDepartmentId', label: 'Department', type: 'select', options: deptOptions, required: true },
            { key: 'processCode', label: 'Code' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'machines' && (
        <CrudResource<RequestMachine>
          title="Machines"
          resource="request-machines"
          idPrefix="rmac"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={requestMachines}
          refresh={refresh}
          columns={[
            { key: 'machineName', header: 'Machine', render: (m) => <div><div className="font-medium">{m.machineName}</div><div className="text-xs text-muted dark:text-muted-dark">{[m.vendor, m.model].filter(Boolean).join(' · ')}</div></div> },
            { key: 'department', header: 'Department', sortAccessor: (m) => lookups.requestDepartmentName(m.requestDepartmentId), render: (m) => lookups.requestDepartmentName(m.requestDepartmentId) },
            { key: 'category', header: 'Category', sortAccessor: (m) => m.machineCategory, render: (m) => <span className="text-muted dark:text-muted-dark">{m.machineCategory}</span> },
            { key: 'active', header: 'Status', render: (m) => activeBadge(m.active) },
          ]}
          fields={[
            { key: 'machineName', label: 'Machine name', required: true },
            { key: 'machineCode', label: 'Code' },
            { key: 'requestDepartmentId', label: 'Department', type: 'select', options: deptOptions, required: true },
            { key: 'requestProcessId', label: 'Process', type: 'select', options: procOptions },
            { key: 'machineCategory', label: 'Category' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'model', label: 'Model' },
            { key: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}
    </div>
  )
}
