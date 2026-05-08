import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import type { Db } from '../../../db';
import { tenants } from '../../../db/schema';
import { UpdateTenantDto } from '../dto/update.tenant.dto';

@Injectable()
export class TenantsService {
  constructor(@Inject('DB') private readonly db: Db) {}

  async create(dto: CreateTenantDto) {
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

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id); // lanza NotFoundException si no existe

    const [updated] = await this.db
      .update(tenants)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    return updated;
  }

  async deactivate(id: string) {
    await this.findOne(id);

    const [updated] = await this.db
      .update(tenants)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    return updated;
  }

  async removePermanently(id: string) {
    await this.findOne(id);

    await this.db.delete(tenants).where(eq(tenants.id, id));
  }
}
