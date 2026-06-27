import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and, isNull, or, gt } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import {
  sdkApiKeys,
  environments,
  projects,
  tenantSubscriptions,
  plans,
} from '../../../db/schema';
import type { Db } from '../../../db';
import type { CachedApiKey } from '../delivery.types';

type CachedApiKeyInternal = CachedApiKey & { _hash: string };

@Injectable()
export class ApiKeyCacheService {
  private readonly logger = new Logger(ApiKeyCacheService.name);

  private readonly verified = new Map<string, CachedApiKey>();

  private readonly byPrefix = new Map<string, CachedApiKeyInternal[]>();

  constructor(@Inject('DB') private readonly db: Db) {}

  async validate(rawKey: string): Promise<CachedApiKey | null> {
    const cached = this.verified.get(rawKey);
    if (cached) {
      if (cached.expiresAt && cached.expiresAt < new Date()) {
        this.verified.delete(rawKey);
      } else {
        return cached;
      }
    }

    const prefix = this.extractPrefix(rawKey);
    if (!prefix) return null;

    let candidates = this.byPrefix.get(prefix);
    if (!candidates) {
      candidates = await this.loadFromDb(prefix);
      if (!candidates.length) return null;
      this.byPrefix.set(prefix, candidates);
    }

    for (const candidate of candidates) {
      if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;

      const match = await bcrypt.compare(rawKey, candidate._hash);
      if (match) {
        const { _hash, ...safe } = candidate;
        this.verified.set(rawKey, safe);
        return safe;
      }
    }

    return null;
  }

  invalidate(prefix: string): void {
    this.byPrefix.delete(prefix);
    for (const key of this.verified.keys()) {
      if (key.startsWith(prefix + '_')) {
        this.verified.delete(key);
      }
    }
    this.logger.debug(`API key cache invalidated for prefix ${prefix}`);
  }

  invalidateAll(): void {
    this.verified.clear();
    this.byPrefix.clear();
  }

  private extractPrefix(rawKey: string): string | null {
    const parts = rawKey.split('_');
    if (parts.length < 3) return null;
    return parts.slice(0, -1).join('_');
  }

  private async loadFromDb(prefix: string): Promise<CachedApiKeyInternal[]> {
    this.logger.debug(`Loading API keys from DB for prefix "${prefix}"`);

    const now = new Date();

    const rows = await this.db
      .select({
        keyHash: sdkApiKeys.keyHash,
        environmentId: sdkApiKeys.environmentId,
        expiresAt: sdkApiKeys.expiresAt,
        tenantId: projects.tenantId,
        hasSse: plans.hasSse,
      })
      .from(sdkApiKeys)
      .innerJoin(environments, eq(sdkApiKeys.environmentId, environments.id))
      .innerJoin(projects, eq(environments.projectId, projects.id))
      .innerJoin(
        tenantSubscriptions,
        and(
          eq(tenantSubscriptions.tenantId, projects.tenantId),
          or(
            isNull(tenantSubscriptions.endsAt),
            gt(tenantSubscriptions.endsAt, now),
          ),
        ),
      )
      .innerJoin(plans, eq(tenantSubscriptions.planId, plans.id))
      .where(
        and(eq(sdkApiKeys.keyPrefix, prefix), eq(sdkApiKeys.isActive, true)),
      );

    return rows.map((row) => ({
      environmentId: row.environmentId,
      tenantId: row.tenantId,
      hasSse: row.hasSse,
      expiresAt: row.expiresAt,
      _hash: row.keyHash,
    }));
  }
}
