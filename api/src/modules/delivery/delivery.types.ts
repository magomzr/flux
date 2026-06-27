export interface CachedFlagEntry {
  enabled: boolean;
  value: string | null;
  type: string;
}

export interface EnvironmentCache {
  flags: Map<string, CachedFlagEntry>;
  loadedAt: number;
  etag: string;
}

export interface CachedApiKey {
  environmentId: string;
  tenantId: string;
  hasSse: boolean;
  expiresAt: Date | null;
}

export interface SdkFlagPayload {
  key: string;
  enabled: boolean;
  value: string | null;
  type: string;
}

export const FLAG_CHANGED_EVENT = 'flag.changed';

export interface FlagChangedEvent {
  environmentId: string;
  flagKey?: string;
}
