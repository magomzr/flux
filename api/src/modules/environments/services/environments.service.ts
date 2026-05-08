import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { CreateEnvironmentDto } from '../dto/create-environment.dto';
import { UpdateEnvironmentDto } from '../dto/update-environment.dto';
import { environments } from '../../../db/schema';
import type { Db } from '../../../db';

@Injectable()
export class EnvironmentsService {
  constructor(@Inject('DB') private readonly db: Db) {}

  async create(projectId: string, dto: CreateEnvironmentDto) {
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

  async update(id: string, dto: UpdateEnvironmentDto) {
    const environment = await this.findOne(id);

    if (dto.isDefault) {
      await this.clearDefault(environment.projectId);
    }

    const [updated] = await this.db
      .update(environments)
      .set(dto)
      .where(eq(environments.id, id))
      .returning();

    return updated;
  }

  async removePermanently(id: string) {
    await this.findOne(id);

    await this.db.delete(environments).where(eq(environments.id, id));
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
