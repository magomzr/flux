/**
 * Catálogo de acciones auditables del sistema.
 * Formato: '<entidad>.<acción>'
 */
export const AuditAction = {
  // Tenants
  TENANT_CREATED: 'tenant.created',
  TENANT_UPDATED: 'tenant.updated',
  TENANT_DEACTIVATED: 'tenant.deactivated',
  TENANT_DELETED: 'tenant.deleted',

  // Projects
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DEACTIVATED: 'project.deactivated',
  PROJECT_DELETED: 'project.deleted',

  // Environments
  ENVIRONMENT_CREATED: 'environment.created',
  ENVIRONMENT_UPDATED: 'environment.updated',
  ENVIRONMENT_DELETED: 'environment.deleted',

  // Flags
  FLAG_CREATED: 'flag.created',
  FLAG_UPDATED: 'flag.updated',
  FLAG_DELETED: 'flag.deleted',
  FLAG_VALUE_UPDATED: 'flag_value.updated',
  FLAG_VALUE_PUBLISHED: 'flag_value.published',

  // Auth
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',

  // SDK Keys
  SDK_KEY_CREATED: 'sdk_key.created',
  SDK_KEY_REVOKED: 'sdk_key.revoked',
  SDK_KEY_DELETED: 'sdk_key.deleted',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditContext {
  /** ID del usuario que realizó la acción (null = sistema) */
  userId: string | null;
  /** Email del usuario al momento de la acción — snapshot inmutable */
  userEmail?: string | null;
  /** ID del tenant al que pertenece la acción */
  tenantId: string | null;
  /** IP del request */
  ip?: string;
}

export interface AuditEntry {
  action: AuditActionType;
  entityType: string;
  entityId: string;
  context: AuditContext;
  /** Cualquier dato adicional relevante: diff, valores anteriores, etc. */
  metadata?: Record<string, unknown>;
}
