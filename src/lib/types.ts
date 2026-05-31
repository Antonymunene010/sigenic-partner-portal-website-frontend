// Re-export shim — the data contract now lives in shared/ (single source of truth
// for client and server). Import sites keep using '@/lib/types' / './types' unchanged.
export * from '../../shared/types'
