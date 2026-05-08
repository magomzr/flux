import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq } from 'drizzle-orm';
import { CreateFlagDto } from '../dto/create-flag.dto';
import { UpdateFlagDto } from '../dto/update-flag.dto';
import { UpdateFlagValueDto } from '../dto/update-flag-value.dto';
import { environments, flagValues, flags } from '../../../db/schema';
import { AuditService } from '../../audit/services/audit.service';
import { AuditAction } from '../../audit/audit.types';
import { FLAG_CHANGED_EVENT } from '../../delivery/delivery.types';
import type { AuditContext } from '../../audit/audit.types';
import type { FlagChangedEvent } from '../../delivery/delivery.types';
import type { Db } from '../../../db';

@Injectable()
export class FlagsService {
  constructor(
    @Inject('DB') private readonly db: Db,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async create(projectId: string, dto: CreateFlagDto, ctx: AuditContext) {
    const existing = await this.db.query.flags.findFirst({
      where: and(eq(flags.projectId, projectId), eq(flags.key, dto.key)),
    });

    if (existing) {
      throw new ConflictException(
        `Key "${dto.key}" is already taken in this project`,
      );
    }

    const [flag] = await this.db
      .insert(flags)
      .values({
        projectId,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type ?? 'boolean',
      })
      .returning();

    const projectEnvironments = await this.db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
      columns: { id: true },
    });

    if (projectEnvironments.length > 0) {
      await this.db.insert(flagValues).values(
        projectEnvironments.map((env) => ({
          flagId: flag.id,
          environmentId: env.id,
        })),
      );
    }

    await this.audit.log({
      action: AuditAction.FLAG_CREATED,
      entityType: 'flag',
      entityId: flag.id,
      context: ctx,
      metadata: { key: flag.key, name: flag.name, type: flag.type, projectId },
    });

    return flag;
  }

  async findAllByProject(projectId: string) {
    return this.db.query.flags.findMany({
      where: eq(flags.projectId, projectId),
      orderBy: (f, { asc }) => asc(f.key),
    });
  }

  async findOne(id: string) {
    const flag = await this.db.query.flags.findFirst({
      where: eq(flags.id, id),
      with: { flagValues: true },
    });

    if (!flag) throw new NotFoundException(`Flag ${id} not found`);

    return flag;
  }

  async update(id: string, dto: UpdateFlagDto, ctx: AuditContext) {
    const before = await this.findOne(id);

    const [updated] = await this.db
      .update(flags)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(flags.id, id))
      .returning();

    await this.audit.log({
      action: AuditAction.FLAG_UPDATED,
      entityType: 'flag',
      entityId: id,
      context: ctx,
      metadata: { before: { name: before.name, description: before.description }, after: dto },
    });

    return updated;
  }

  async removePermanently(id: string, ctx: AuditContext) {
    const flag = await this.findOne(id);

    await this.db.delete(flags).where(eq(flags.id, id));

    await this.audit.log({
      action: AuditAction.FLAG_DELETED,
      entityType: 'flag',
      entityId: id,
      context: ctx,
      metadata: { key: flag.key, name: flag.name },
    });
  }

  // ─── Flag values ─────────────────────────────────────────────────────────────

  async getFlagValue(flagId: string, environmentId: string) {
    const flagValue = await this.db.query.flagValues.findFirst({
      where: and(
        eq(flagValues.flagId, flagId),
        eq(flagValues.environmentId, environmentId),
      ),
    });

    if (!flagValue) {
      throw new NotFoundException(
        `Flag value not found for flag ${flagId} in environment ${environmentId}`,
      );
    }

    return flagValue;
  }

  async updateFlagValue(
    flagId: string,
    environmentId: string,
    dto: UpdateFlagValueDto,
    ctx: AuditContext,
  ) {
    const before = await this.getFlagValue(flagId, environmentId);

    const [updated] = await this.db
      .update(flagValues)
      .set({ ...dto, updatedAt: new Date() })
      .where(
        and(
          eq(flagValues.flagId, flagId),
          eq(flagValues.environmentId, environmentId),
        ),
      )
      .returning();

    await this.audit.log({
      action: AuditAction.FLAG_VALUE_UPDATED,
      entityType: 'flag_value',
      entityId: before.id,
      context: ctx,
      metadata: {
        flagId,
        environmentId,
        before: { enabled: before.enabled, value: before.value },
        after: dto,
      },
    });

    // Invalidar cache del ambiente afectado
    this.emitFlagChanged(environmentId);

    return updated;
  }

  async publishFlagValue(
    flagId: string,
    environmentId: string,
    ctx: AuditContext,
  ) {
    const before = await this.getFlagValue(flagId, environmentId);

    const [updated] = await this.db
      .update(flagValues)
      .set({
        publishedAt: new Date(),
        publishedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(flagValues.flagId, flagId),
          eq(flagValues.environmentId, environmentId),
        ),
      )
      .returning();

    await this.audit.log({
      action: AuditAction.FLAG_VALUE_PUBLISHED,
      entityType: 'flag_value',
      entityId: before.id,
      context: ctx,
      metadata: { flagId, environmentId, enabled: before.enabled },
    });

    // Invalidar cache y notificar SSE
    this.emitFlagChanged(environmentId, before.id);

    return updated;
  }

  // ─── Privados ─────────────────────────────────────────────────────────────────

  private emitFlagChanged(environmentId: string, flagKey?: string): void {
    const event: FlagChangedEvent = { environmentId, flagKey };
    this.events.emit(FLAG_CHANGED_EVENT, event);
  }
}
