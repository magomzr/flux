// ─── Tenants ──────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Environments ─────────────────────────────────────────────────────────────

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  color: string | null;
  isDefault: boolean;
  createdAt: string;
}

// ─── Flags ────────────────────────────────────────────────────────────────────

export type FlagType = 'boolean' | 'string' | 'number' | 'json';

export interface Flag {
  id: string;
  projectId: string;
  key: string;
  name: string;
  description: string | null;
  type: FlagType;
  createdAt: string;
  updatedAt: string;
  flagValues?: FlagValue[];
}

export interface FlagValue {
  id: string;
  flagId: string;
  environmentId: string;
  enabled: boolean;
  value: string | null;
  updatedAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
}

// ─── SDK Keys ─────────────────────────────────────────────────────────────────

export interface SdkKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  key?: string; // solo presente al crear
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  maxFlags: number | null;
  maxProjects: number | null;
  maxEnvironments: number | null;
  maxEvaluationsMonth: number | null;
  maxAssetStorageMb: number | null;
  hasSse: boolean;
  pollIntervalSeconds: number;
  priceUsd: number;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  startedAt: string;
  endsAt: string | null;
  createdAt: string;
}

export interface UsageForecast {
  period: {
    year: number;
    month: number;
    dayOfMonth: number;
    daysInMonth: number;
    percentElapsed: number;
  };
  plan: { id: string; name: string; baseCostUsd: number } | null;
  actual: {
    evaluationsCount: number;
    assetStorageMb: number;
    sseConnectionsMax: number;
  };
  projected: {
    evaluationsCount: number;
    assetStorageMb: number;
    sseConnectionsMax: number;
  };
  cost: {
    baseCostUsd: number;
    overageCostUsd: number;
    totalCostUsd: number;
    breakdown: Record<string, number>;
  };
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}
