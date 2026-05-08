import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { projects } from '../../../db/schema';
import { AuditService } from '../../audit/services/audit.service';
import { AuditAction } from '../../audit/audit.types';
import type { AuditContext } from '../../audit/audit.types';
import type { Db } from '../../../db';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject('DB') private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateProjectDto & { tenantId: string }, ctx: AuditContext) {
    const existing = await this.db.query.projects.findFirst({
      where: and(
        eq(projects.tenantId, dto.tenantId),
        eq(projects.slug, dto.slug),
      ),
    });

    if (existing) {
      throw new ConflictException(
        `Slug "${dto.slug}" is already taken in this tenant`,
      );
    }

    const [project] = await this.db
      .insert(projects)
      .values({
        tenantId: dto.tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
      })
      .returning();

    await this.audit.log({
      action: AuditAction.PROJECT_CREATED,
      entityType: 'project',
      entityId: project.id,
      context: ctx,
      metadata: { name: project.name, slug: project.slug },
    });

    return project;
  }

  async findAllByTenant(tenantId: string) {
    return this.db.query.projects.findMany({
      where: eq(projects.tenantId, tenantId),
      orderBy: (p, { desc }) => desc(p.createdAt),
    });
  }

  async findOne(id: string) {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, ctx: AuditContext) {
    const before = await this.findOne(id);

    const [updated] = await this.db
      .update(projects)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    await this.audit.log({
      action: AuditAction.PROJECT_UPDATED,
      entityType: 'project',
      entityId: id,
      context: ctx,
      metadata: { before: { name: before.name, description: before.description }, after: dto },
    });

    return updated;
  }

  async deactivate(id: string, ctx: AuditContext) {
    await this.findOne(id);

    const [updated] = await this.db
      .update(projects)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    await this.audit.log({
      action: AuditAction.PROJECT_DEACTIVATED,
      entityType: 'project',
      entityId: id,
      context: ctx,
    });

    return updated;
  }

  async removePermanently(id: string, ctx: AuditContext) {
    const project = await this.findOne(id);

    await this.db.delete(projects).where(eq(projects.id, id));

    await this.audit.log({
      action: AuditAction.PROJECT_DELETED,
      entityType: 'project',
      entityId: id,
      context: ctx,
      metadata: { name: project.name, slug: project.slug },
    });
  }
}
