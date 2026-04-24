import type { ReactNode } from 'react'

type LogoProps = { className?: string }

function WordmarkSvg({
  viewBox,
  labelX,
  label,
  className,
  children,
}: {
  viewBox: string
  labelX: number
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <svg viewBox={viewBox} className={className} fill="none" aria-hidden>
      {children}
      <text
        x={labelX}
        y="21"
        fill="currentColor"
        fontFamily="Geist, system-ui, sans-serif"
        fontSize="15"
        fontWeight="600"
        letterSpacing="-0.01em"
      >
        {label}
      </text>
    </svg>
  )
}

const NovaCellMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 160 32" labelX={34} label="NovaCell" className={className}>
    <circle cx="14" cy="16" r="9" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="14" cy="16" r="3.2" fill="currentColor" />
    <path
      d="M14 4.5V2M14 30v-2.5M2 16h2.5M23.5 16H26"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </WordmarkSvg>
)

const QuantexMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 160 32" labelX={30} label="Quantex" className={className}>
    <path d="M6 6 L18 6 L22 10 L22 22 L18 26 L6 26 L2 22 L2 10 Z" stroke="currentColor" strokeWidth="1.6" />
    <path d="M14 16 L22 26" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </WordmarkSvg>
)

const ApertureMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 170 32" labelX={30} label="Aperture" className={className}>
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="14" cy="16" r="9" />
      <path d="M14 7 L20 13 L20 19 L14 25 L8 19 L8 13 Z" />
      <path d="M14 16 L20 13 M14 16 L20 19 M14 16 L14 25 M14 16 L8 19 M14 16 L8 13 M14 16 L14 7" />
    </g>
  </WordmarkSvg>
)

const SiliconPeakMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 190 32" labelX={36} label="SiliconPeak" className={className}>
    <path d="M3 24 L11 12 L17 20 L23 8 L29 24 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </WordmarkSvg>
)

const HeliosFabMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 170 32" labelX={30} label="HeliosFab" className={className}>
    <circle cx="14" cy="16" r="5" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M14 4v4M14 24v4M4 16h4M20 16h4M7 9l2.5 2.5M18.5 20.5L21 23M7 23l2.5-2.5M18.5 11.5L21 9" />
    </g>
  </WordmarkSvg>
)

const KyotoMicroMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 180 32" labelX={28} label="Kyoto Micro" className={className}>
    <rect x="4" y="8" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M9 8v-3M15 8v-3M9 24v3M15 24v3M4 13H1M4 19H1M20 13h3M20 19h3"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <circle cx="12" cy="16" r="2.5" fill="currentColor" />
  </WordmarkSvg>
)

const MeridianWaferMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 200 32" labelX={28} label="Meridian Wafer" className={className}>
    <path d="M4 16 C 4 8, 20 8, 20 16 C 20 24, 4 24, 4 16 Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 16 L20 16" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="12" cy="16" r="1.4" fill="currentColor" />
  </WordmarkSvg>
)

const EmberLogicMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 170 32" labelX={26} label="Ember Logic" className={className}>
    <path
      d="M12 4 C 7 10, 7 14, 11 18 C 7 19, 6 22, 8 25 C 13 27, 18 24, 18 19 C 18 14, 14 10, 12 4 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </WordmarkSvg>
)

const OrionSemiMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 170 32" labelX={30} label="Orion Semi" className={className}>
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="10" r="1.8" fill="currentColor" />
      <circle cx="14" cy="16" r="1.8" fill="currentColor" />
      <circle cx="20" cy="22" r="1.8" fill="currentColor" />
      <path d="M8 10 L14 16 L20 22" />
      <circle cx="22" cy="8" r="1.2" fill="currentColor" />
      <circle cx="6" cy="24" r="1.2" fill="currentColor" />
    </g>
  </WordmarkSvg>
)

const VertexFoundryMark = ({ className }: LogoProps) => (
  <WordmarkSvg viewBox="0 0 200 32" labelX={30} label="Vertex Foundry" className={className}>
    <path d="M4 24 L14 6 L24 24 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 18 L19 18" stroke="currentColor" strokeWidth="1.4" />
  </WordmarkSvg>
)

export type PartnerLogo = {
  id: string
  name: string
  industry: string
  region: string
  tier: 'Strategic' | 'Preferred' | 'Ecosystem'
  render: (props: LogoProps) => ReactNode
}

export const PARTNER_LOGOS: PartnerLogo[] = [
  { id: 'novacell', name: 'NovaCell Systems', industry: 'Logic · 7nm', region: 'Singapore', tier: 'Strategic', render: NovaCellMark },
  { id: 'quantex', name: 'Quantex Semiconductors', industry: 'Memory · DRAM', region: 'Malaysia', tier: 'Strategic', render: QuantexMark },
  { id: 'aperture', name: 'Aperture Wafer Co.', industry: 'Foundry services', region: 'Taiwan', tier: 'Preferred', render: ApertureMark },
  { id: 'siliconpeak', name: 'SiliconPeak Labs', industry: 'Logic · 10nm', region: 'Singapore', tier: 'Strategic', render: SiliconPeakMark },
  { id: 'helios', name: 'HeliosFab', industry: 'Power · Analog', region: 'Japan', tier: 'Preferred', render: HeliosFabMark },
  { id: 'kyoto', name: 'Kyoto Micro', industry: 'MEMS · Sensors', region: 'Japan', tier: 'Ecosystem', render: KyotoMicroMark },
  { id: 'meridian', name: 'Meridian Wafer', industry: 'Substrate', region: 'Korea', tier: 'Preferred', render: MeridianWaferMark },
  { id: 'ember', name: 'Ember Logic', industry: 'Logic · 5nm', region: 'US', tier: 'Strategic', render: EmberLogicMark },
  { id: 'orion', name: 'Orion Semi', industry: 'RF · Networking', region: 'Germany', tier: 'Ecosystem', render: OrionSemiMark },
  { id: 'vertex', name: 'Vertex Foundry', industry: 'Foundry services', region: 'Taiwan', tier: 'Preferred', render: VertexFoundryMark },
]

export type Industry = {
  slug: string
  name: string
  partnerCount: number
  outcome: string
  signals: string[]
  tint: string
}

export const INDUSTRIES: Industry[] = [
  {
    slug: 'logic',
    name: 'Logic fabs',
    partnerCount: 14,
    outcome: 'Parametric yield lift on 5–7nm lines with overlay + etch co-tuning.',
    signals: ['Overlay co-tuning', 'Edge-die recovery', 'Dose-focus sweeps'],
    tint: 'bg-info',
  },
  {
    slug: 'memory',
    name: 'Memory & DRAM',
    partnerCount: 8,
    outcome: 'Excursion early-warning and chamber-pressure anomaly detection.',
    signals: ['Anomaly models', 'Pressure drift', 'Deposition telemetry'],
    tint: 'bg-accent',
  },
  {
    slug: 'foundry',
    name: 'Foundry services',
    partnerCount: 11,
    outcome: 'Unified wafer-map QA and marginal-die triage across sites.',
    signals: ['Review viewer', 'Shared rules', 'Multi-site QA'],
    tint: 'bg-warn',
  },
  {
    slug: 'specialty',
    name: 'Specialty & analog',
    partnerCount: 6,
    outcome: 'Throughput co-tuning on mature nodes — zero-capex capacity gains.',
    signals: ['Recipe tuning', 'Throughput sprints', 'APC uplift'],
    tint: 'bg-success',
  },
]

export type PartnerEvent = {
  id: string
  title: string
  kind: 'Webinar' | 'Workshop' | 'Roundtable' | 'Release'
  date: string
  monthLabel: string
  dayLabel: string
  location: string
  cta: string
}

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short' })

function makeEvent(
  e: Omit<PartnerEvent, 'monthLabel' | 'dayLabel'>,
): PartnerEvent {
  const d = new Date(e.date)
  return { ...e, monthLabel: MONTH_FMT.format(d), dayLabel: String(d.getDate()) }
}

const RAW_EVENTS: Omit<PartnerEvent, 'monthLabel' | 'dayLabel'>[] = [
  {
    id: 'ev-1',
    title: 'Excursion early-warning — a live walkthrough',
    kind: 'Webinar',
    date: '2026-05-07',
    location: 'Online · 10:00 SGT',
    cta: 'Reserve seat',
  },
  {
    id: 'ev-2',
    title: 'APAC partner roundtable · Singapore',
    kind: 'Roundtable',
    date: '2026-05-15',
    location: 'Tuas · Invite only',
    cta: 'Request invite',
  },
  {
    id: 'ev-3',
    title: 'Recipe co-tuning hands-on lab',
    kind: 'Workshop',
    date: '2026-05-22',
    location: 'Hsinchu · On-site',
    cta: 'Register interest',
  },
  {
    id: 'ev-4',
    title: 'Portal v0.9 — release preview',
    kind: 'Release',
    date: '2026-04-30',
    location: 'Self-paced',
    cta: 'Read release notes',
  },
]

export const PARTNER_EVENTS: PartnerEvent[] = RAW_EVENTS.map(makeEvent)
