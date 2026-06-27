import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { sdkApiKeys, environments } from '../../../db/schema';
import { ApiKeyCacheService } from '../../delivery/services/api-key-cache.service';
import { AuditService } from '../../audit/services/audit.service';
import { AuditAction } from '../../audit/audit.types';
import type { CreateSdkKeyDto } from '../dto/create-sdk-key.dto';
import type { AuditContext } from '../../audit/audit.types';
import type { Db } from '../../../db';

@Injectable()
export class SdkKeysService {
  constructor(
    @Inject('DB') private readonly db: Db,
    private readonly apiKeyCache: ApiKeyCacheService,
    private readonly audit: AuditService,
  ) {}

  async create(environmentId: string, dto: CreateSdkKeyDto, ctx: AuditContext) {
    const environment = await this.db.query.environments.findFirst({
      where: eq(environments.id, environmentId),
      columns: { id: true, slug: true },
    });

    if (!environment) {
      throw new NotFoundException(`Environment ${environmentId} not found`);
    }

    const rawSecret = randomBytes(20).toString('hex');
    const prefix = `flux_${environment.slug}`;
    const rawKey = `${prefix}_${rawSecret}`;
    const keyHash = await bcrypt.hash(rawKey, 10);

    const [key] = await this.db
      .insert(sdkApiKeys)
      .values({
        environmentId,
        name: dto.name,
        keyHash,
        keyPrefix: prefix,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      })
      .returning({
        id: sdkApiKeys.id,
        name: sdkApiKeys.name,
        keyPrefix: sdkApiKeys.keyPrefix,
        isActive: sdkApiKeys.isActive,
        expiresAt: sdkApiKeys.expiresAt,
        createdAt: sdkApiKeys.createdAt,
      });

    await this.audit.log({
      action: AuditAction.SDK_KEY_CREATED,
      entityType: 'sdk_api_key',
      entityId: key.id,
      context: ctx,
      metadata: { name: dto.name, prefix, environmentId },
    });

    return { ...key, key: rawKey };
  }

  async findAllByEnvironment(environmentId: string) {
    return this.db.query.sdkApiKeys.findMany({
      where: eq(sdkApiKeys.environmentId, environmentId),
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: (k, { desc }) => desc(k.createdAt),
    });
  }

  async revoke(id: string, ctx: AuditContext) {
    const key = await this.db.query.sdkApiKeys.findFirst({
      where: eq(sdkApiKeys.id, id),
      columns: { id: true, keyPrefix: true, environmentId: true, name: true },
    });

    if (!key) throw new NotFoundException(`SDK key ${id} not found`);

    await this.db
      .update(sdkApiKeys)
      .set({ isActive: false })
      .where(eq(sdkApiKeys.id, id));

    this.apiKeyCache.invalidate(key.keyPrefix);

    await this.audit.log({
      action: AuditAction.SDK_KEY_REVOKED,
      entityType: 'sdk_api_key',
      entityId: id,
      context: ctx,
      metadata: { name: key.name, prefix: key.keyPrefix },
    });
  }

  async removePermanently(id: string, ctx: AuditContext) {
    const key = await this.db.query.sdkApiKeys.findFirst({
      where: eq(sdkApiKeys.id, id),
      columns: { id: true, keyPrefix: true, name: true },
    });

    if (!key) throw new NotFoundException(`SDK key ${id} not found`);

    await this.db.delete(sdkApiKeys).where(eq(sdkApiKeys.id, id));

    this.apiKeyCache.invalidate(key.keyPrefix);

    await this.audit.log({
      action: AuditAction.SDK_KEY_DELETED,
      entityType: 'sdk_api_key',
      entityId: id,
      context: ctx,
      metadata: { name: key.name, prefix: key.keyPrefix },
    });
  }
}
