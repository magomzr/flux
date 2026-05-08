import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { CreateFlagDto } from '../dto/create-flag.dto';
import { UpdateFlagDto } from '../dto/update-flag.dto';
import { UpdateFlagValueDto } from '../dto/update-flag-value.dto';
import { environments, flagValues, flags } from '../../../db/schema';
import type { Db } from '../../../db';

@Injectable()
export class FlagsService {
  constructor(@Inject('DB') private readonly db: Db) {}

  /**
   * Crea el flag y genera automáticamente un flag_value por cada ambiente
   * del proyecto, todos deshabilitados por defecto.
   */
  async create(projectId: string, dto: CreateFlagDto) {
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

    // Crear flag_value para cada ambiente del proyecto
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

    if (!flag) {
      throw new NotFoundException(`Flag ${id} not found`);
    }

    return flag;
  }

  async update(id: string, dto: UpdateFlagDto) {
    await this.findOne(id);

    const [updated] = await this.db
      .update(flags)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(flags.id, id))
      .returning();

    return updated;
  }

  async removePermanently(id: string) {
    await this.findOne(id);

    await this.db.delete(flags).where(eq(flags.id, id));
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
  ) {
    await this.getFlagValue(flagId, environmentId);

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

    return updated;
  }

  /**
   * Publica el flag en un ambiente: marca publishedAt y publishedBy.
   * Requiere permiso publish:flag — verificado en el controller.
   */
  async publishFlagValue(
    flagId: string,
    environmentId: string,
    publishedBy: string,
  ) {
    await this.getFlagValue(flagId, environmentId);

    const [updated] = await this.db
      .update(flagValues)
      .set({
        publishedAt: new Date(),
        publishedBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(flagValues.flagId, flagId),
          eq(flagValues.environmentId, environmentId),
        ),
      )
      .returning();

    return updated;
  }
}
