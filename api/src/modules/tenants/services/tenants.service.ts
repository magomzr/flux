import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update.tenant.dto';
import { tenants } from '../../../db/schema';
import { AuditService } from '../../audit/services/audit.service';
import { AuditAction } from '../../audit/audit.types';
import type { AuditContext } from '../../audit/audit.types';
import type { Db } from '../../../db';

@Injectable()
export class TenantsService {
  constructor(
    @Inject('DB') private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateTenantDto, ctx: AuditContext) {
    const existing = await this.db.query.tenants.findFirst({
      where: eq(tenants.slug, dto.slug),
    });

    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }

    const [tenant] = await this.db
      .insert(tenants)
      .values({
        name: dto.name,
        slug: dto.slug,
        email: dto.email,
        logoUrl: dto.logoUrl ?? null,
      })
      .returning();

    await this.audit.log({
      action: AuditAction.TENANT_CREATED,
      entityType: 'tenant',
      entityId: tenant.id,
      context: ctx,
      metadata: { name: tenant.name, slug: tenant.slug, email: tenant.email },
    });

    return tenant;
  }

  async findAll() {
    return this.db.query.tenants.findMany({
      orderBy: (t, { desc }) => desc(t.createdAt),
    });
  }

  async findOne(id: string) {
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, id),
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, ctx: AuditContext) {
    const before = await this.findOne(id);

    const [updated] = await this.db
      .update(tenants)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    await this.audit.log({
      action: AuditAction.TENANT_UPDATED,
      entityType: 'tenant',
      entityId: id,
      context: ctx,
      metadata: {
        before: { name: before.name, email: before.email },
        after: dto,
      },
    });

    return updated;
  }

  async deactivate(id: string, ctx: AuditContext) {
    const tenant = await this.findOne(id);

    const [updated] = await this.db
      .update(tenants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    await this.audit.log({
      action: AuditAction.TENANT_DEACTIVATED,
      entityType: 'tenant',
      entityId: id,
      context: ctx,
      metadata: { name: tenant.name, slug: tenant.slug },
    });

    return updated;
  }

  async removePermanently(id: string, ctx: AuditContext) {
    const tenant = await this.findOne(id);

    await this.db.delete(tenants).where(eq(tenants.id, id));

    await this.audit.log({
      action: AuditAction.TENANT_DELETED,
      entityType: 'tenant',
      entityId: id,
      context: ctx,
      metadata: { name: tenant.name, slug: tenant.slug },
    });
  }
}
