import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq, and, isNotNull } from 'drizzle-orm';
import { createHash } from 'crypto';
import { flagValues, flags } from '../../../db/schema';
import type { Db } from '../../../db';
import type {
  CachedFlagEntry,
  EnvironmentCache,
  FlagChangedEvent,
  SdkFlagPayload,
} from '../delivery.types';
import { FLAG_CHANGED_EVENT } from '../delivery.types';

@Injectable()
export class FlagCacheService {
  private readonly logger = new Logger(FlagCacheService.name);

  /**
   * Cache principal: environmentId → EnvironmentCache
   * Map es más rápido que un objeto plano para inserciones/borrados frecuentes.
   */
  private readonly cache = new Map<string, EnvironmentCache>();

  constructor(@Inject('DB') private readonly db: Db) {}

  /**
   * Devuelve todos los flags de un ambiente.
   * Carga lazy desde DB si no está en cache.
   * Hot path — debe ser O(1) cuando el cache está caliente.
   */
  async getAll(environmentId: string): Promise<{
    flags: SdkFlagPayload[];
    etag: string;
  }> {
    const cached = await this.getOrLoad(environmentId);
    return {
      flags: this.toPayloadArray(cached.flags),
      etag: cached.etag,
    };
  }

  /**
   * Devuelve un flag específico por key.
   * Hot path — O(1) lookup en Map.
   */
  async getOne(
    environmentId: string,
    key: string,
  ): Promise<SdkFlagPayload | null> {
    const cached = await this.getOrLoad(environmentId);
    const entry = cached.flags.get(key);
    if (!entry) return null;
    return { key, ...entry };
  }

  /**
   * Devuelve el ETag actual sin cargar los flags.
   * Usado para validar conditional GET sin serializar el payload.
   */
  async getEtag(environmentId: string): Promise<string> {
    const cached = await this.getOrLoad(environmentId);
    return cached.etag;
  }

  /**
   * Invalida el cache de un ambiente.
   * Llamado cuando un flag cambia — el próximo request recarga desde DB.
   */
  @OnEvent(FLAG_CHANGED_EVENT)
  handleFlagChanged(event: FlagChangedEvent): void {
    if (this.cache.has(event.environmentId)) {
      this.cache.delete(event.environmentId);
      this.logger.debug(
        `Cache invalidated for environment ${event.environmentId}`,
      );
    }
  }

  /** Invalida todos los ambientes — usado en casos de emergencia */
  invalidateAll(): void {
    this.cache.clear();
    this.logger.warn('Full cache invalidated');
  }

  // ─── Privados ─────────────────────────────────────────────────────────────────

  private async getOrLoad(environmentId: string): Promise<EnvironmentCache> {
    const cached = this.cache.get(environmentId);
    if (cached) return cached;

    return this.loadFromDb(environmentId);
  }

  private async loadFromDb(environmentId: string): Promise<EnvironmentCache> {
    this.logger.debug(`Loading flags from DB for environment ${environmentId}`);

    // JOIN flags + flag_values en una sola query
    const rows = await this.db
      .select({
        key: flags.key,
        type: flags.type,
        enabled: flagValues.enabled,
        value: flagValues.value,
      })
      .from(flagValues)
      .innerJoin(flags, eq(flagValues.flagId, flags.id))
      .where(
        and(
          eq(flagValues.environmentId, environmentId),
          isNotNull(flagValues.publishedAt),
        ),
      );

    const flagMap = new Map<string, CachedFlagEntry>();
    for (const row of rows) {
      flagMap.set(row.key, {
        enabled: row.enabled,
        value: row.value,
        type: row.type,
      });
    }

    const etag = this.computeEtag(flagMap);
    const entry: EnvironmentCache = {
      flags: flagMap,
      loadedAt: Date.now(),
      etag,
    };

    this.cache.set(environmentId, entry);
    return entry;
  }

  /**
   * Computa un ETag determinístico del estado actual de los flags.
   * Permite al cliente hacer conditional GET con If-None-Match.
   */
  private computeEtag(flagMap: Map<string, CachedFlagEntry>): string {
    // Ordenar por key para que el hash sea determinístico
    const sorted = [...flagMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v.enabled ? '1' : '0'}:${v.value ?? ''}`)
      .join('|');

    return createHash('sha1').update(sorted).digest('hex').slice(0, 16);
  }

  private toPayloadArray(
    flagMap: Map<string, CachedFlagEntry>,
  ): SdkFlagPayload[] {
    const result: SdkFlagPayload[] = [];
    for (const [key, entry] of flagMap) {
      result.push({ key, ...entry });
    }
    return result;
  }
}
