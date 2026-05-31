import { uid } from '../util/ids'
import type { AuthPayload } from '../infra/auth'

type AuditStore = { appendAudit: (entry: Record<string, unknown>) => Promise<unknown> }

/**
 * Best-effort audit-log append. Never throws (a failed audit must not fail the
 * mutation it records), mirroring the original index.js behaviour.
 */
export async function audit(
  store: AuditStore,
  auth: Pick<AuthPayload, 'sub' | 'name'> | null,
  entityType: string,
  entityId: string | null,
  action: string,
  oldVal?: unknown,
  newVal?: unknown,
): Promise<void> {
  await store
    .appendAudit({
      id: uid('al'),
      user_id: auth?.sub ?? null,
      actor_name: auth?.name ?? 'system',
      entity_type: entityType,
      entity_id: entityId ?? null,
      action,
      old_value_json: oldVal ?? null,
      new_value_json: newVal ?? null,
    })
    .catch(() => {})
}
