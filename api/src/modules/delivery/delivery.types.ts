/**
 * Entrada del cache de flags por ambiente.
 * Estructura optimizada para O(1) lookup por key.
 */
export interface CachedFlagEntry {
  enabled: boolean;
  value: string | null;
  type: string;
}

export interface EnvironmentCache {
  /** Map<flagKey, CachedFlagEntry> — lookup O(1) */
  flags: Map<string, CachedFlagEntry>;
  /** Timestamp de carga para TTL y debugging */
  loadedAt: number;
  /** ETag para conditional GET — hash del contenido */
  etag: string;
}

/**
 * Entrada del cache de API keys.
 * Se valida contra este cache en cada request SDK — nunca contra DB.
 */
export interface CachedApiKey {
  environmentId: string;
  tenantId: string;
  hasSse: boolean;
  pollIntervalSeconds: number;
  expiresAt: Date | null;
}

/** Payload mínimo que la SDK necesita por flag */
export interface SdkFlagPayload {
  key: string;
  enabled: boolean;
  value: string | null;
  type: string;
}

/** Evento interno emitido cuando un flag cambia */
export const FLAG_CHANGED_EVENT = 'flag.changed';

export interface FlagChangedEvent {
  environmentId: string;
  flagKey?: string; // undefined = todos los flags del ambiente cambiaron
}
