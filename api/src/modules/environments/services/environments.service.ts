import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { CreateEnvironmentDto } from '../dto/create-environment.dto';
import { UpdateEnvironmentDto } from '../dto/update-environment.dto';
import { environments, flags, flagValues } from '../../../db/schema';
import { AuditService } from '../../audit/services/audit.service';
import { AuditAction } from '../../audit/audit.types';
import type { AuditContext } from '../../audit/audit.types';
import type { Db } from '../../../db';

@Injectable()
export class EnvironmentsService {
  constructor(
    @Inject('DB') private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async create(projectId: string, dto: CreateEnvironmentDto, ctx: AuditContext) {
    const existing = await this.db.query.environments.findFirst({
      where: and(
        eq(environments.projectId, projectId),
        eq(environments.slug, dto.slug),
      ),
    });

    if (existing) {
      throw new ConflictException(
        `Slug "${dto.slug}" is already taken in this project`,
      );
    }

    if (dto.isDefault) {
      await this.clearDefault(projectId);
    }

    const [environment] = await this.db
      .insert(environments)
      .values({
        projectId,
        name: dto.name,
        slug: dto.slug,
        color: dto.color ?? null,
        isDefault: dto.isDefault ?? false,
      })
      .returning();

    await this.audit.log({
      action: AuditAction.ENVIRONMENT_CREATED,
      entityType: 'environment',
      entityId: environment.id,
      context: ctx,
      metadata: { name: environment.name, slug: environment.slug, projectId },
    });

    // Crear flag_values para todos los flags existentes en el proyecto
    const projectFlags = await this.db.query.flags.findMany({
      where: eq(flags.projectId, projectId),
      columns: { id: true },
    });

    if (projectFlags.length > 0) {
      await this.db.insert(flagValues).values(
        projectFlags.map((flag) => ({
          flagId: flag.id,
          environmentId: environment.id,
        })),
      );
    }

    return environment;
  }

  async findAllByProject(projectId: string) {
    return this.db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
      orderBy: (e, { asc }) => asc(e.createdAt),
    });
  }

  async findOne(id: string) {
    const environment = await this.db.query.environments.findFirst({
      where: eq(environments.id, id),
    });

    if (!environment) {
      throw new NotFoundException(`Environment ${id} not found`);
    }

    return environment;
  }

  async update(id: string, dto: UpdateEnvironmentDto, ctx: AuditContext) {
    const before = await this.findOne(id);

    if (dto.isDefault) {
      await this.clearDefault(before.projectId);
    }

    const [updated] = await this.db
      .update(environments)
      .set(dto)
      .where(eq(environments.id, id))
      .returning();

    await this.audit.log({
      action: AuditAction.ENVIRONMENT_UPDATED,
      entityType: 'environment',
      entityId: id,
      context: ctx,
      metadata: { before: { name: before.name, color: before.color }, after: dto },
    });

    return updated;
  }

  async removePermanently(id: string, ctx: AuditContext) {
    const environment = await this.findOne(id);

    await this.db.delete(environments).where(eq(environments.id, id));

    await this.audit.log({
      action: AuditAction.ENVIRONMENT_DELETED,
      entityType: 'environment',
      entityId: id,
      context: ctx,
      metadata: { name: environment.name, slug: environment.slug },
    });
  }

  // ─── Privados ────────────────────────────────────────────────────────────────

  private async clearDefault(projectId: string) {
    await this.db
      .update(environments)
      .set({ isDefault: false })
      .where(
        and(
          eq(environments.projectId, projectId),
          eq(environments.isDefault, true),
        ),
      );
  }
}
