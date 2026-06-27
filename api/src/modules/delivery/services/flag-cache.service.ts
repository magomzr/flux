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

  private readonly cache = new Map<string, EnvironmentCache>();

  constructor(@Inject('DB') private readonly db: Db) {}

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

  async getOne(
    environmentId: string,
    key: string,
  ): Promise<SdkFlagPayload | null> {
    const cached = await this.getOrLoad(environmentId);
    const entry = cached.flags.get(key);
    if (!entry) return null;
    return { key, ...entry };
  }

  async getEtag(environmentId: string): Promise<string> {
    const cached = await this.getOrLoad(environmentId);
    return cached.etag;
  }

  @OnEvent(FLAG_CHANGED_EVENT)
  handleFlagChanged(event: FlagChangedEvent): void {
    if (this.cache.has(event.environmentId)) {
      this.cache.delete(event.environmentId);
      this.logger.debug(
        `Cache invalidated for environment ${event.environmentId}`,
      );
    }
  }

  invalidateAll(): void {
    this.cache.clear();
    this.logger.warn('Full cache invalidated');
  }

  private async getOrLoad(environmentId: string): Promise<EnvironmentCache> {
    const cached = this.cache.get(environmentId);
    if (cached) return cached;

    return this.loadFromDb(environmentId);
  }

  private async loadFromDb(environmentId: string): Promise<EnvironmentCache> {
    this.logger.debug(`Loading flags from DB for environment ${environmentId}`);

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

  private computeEtag(flagMap: Map<string, CachedFlagEntry>): string {
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
