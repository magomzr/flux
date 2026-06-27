export const AuditAction = {
  TENANT_CREATED: 'tenant.created',
  TENANT_UPDATED: 'tenant.updated',
  TENANT_DEACTIVATED: 'tenant.deactivated',
  TENANT_DELETED: 'tenant.deleted',

  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DEACTIVATED: 'project.deactivated',
  PROJECT_DELETED: 'project.deleted',

  ENVIRONMENT_CREATED: 'environment.created',
  ENVIRONMENT_UPDATED: 'environment.updated',
  ENVIRONMENT_DELETED: 'environment.deleted',

  FLAG_CREATED: 'flag.created',
  FLAG_UPDATED: 'flag.updated',
  FLAG_DELETED: 'flag.deleted',
  FLAG_VALUE_UPDATED: 'flag_value.updated',
  FLAG_VALUE_PUBLISHED: 'flag_value.published',

  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',

  SDK_KEY_CREATED: 'sdk_key.created',
  SDK_KEY_REVOKED: 'sdk_key.revoked',
  SDK_KEY_DELETED: 'sdk_key.deleted',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditContext {
  userId: string | null;
  userEmail?: string | null;
  tenantId: string | null;
  ip?: string;
}

export interface AuditEntry {
  action: AuditActionType;
  entityType: string;
  entityId: string;
  context: AuditContext;
  metadata?: Record<string, unknown>;
}
