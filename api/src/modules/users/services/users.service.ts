import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import type { Db } from '../../../db';
import { users } from '../../../db/schema';
import { ROLE_PERMISSIONS } from '../../../common/config/roles.config';
import { LoginDto } from '../../auth/dto/login.dto';
import type { CreateUserDto } from '../dto/create-user.dto';
import type { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@Inject('DB') private readonly db: Db) {}

  // ─── Auth helpers (usados por AuthService) ────────────────────────────────

  async findByEmail(email: string) {
    return this.db.query.users.findFirst({ where: eq(users.email, email) });
  }

  async findById(id: string) {
    return this.db.query.users.findFirst({ where: eq(users.id, id) });
  }

  getPermissions(role: string): string[] {
    return ROLE_PERMISSIONS[role] ?? [];
  }

  async validateCredentials(dto: LoginDto) {
    const user = await this.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    return user;
  }

  // ─── CRUD por tenant ──────────────────────────────────────────────────────

  async findAllByTenant(tenantId: string) {
    const rows = await this.db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
      orderBy: (u, { asc }) => asc(u.name),
      columns: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        // password nunca se expone
      },
    });
    return rows;
  }

  async findOneInTenant(id: string, tenantId: string) {
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.tenantId, tenantId)),
      columns: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) throw new NotFoundException(`User ${id} not found in this tenant`);
    return user;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`Email "${dto.email}" is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const [user] = await this.db
      .insert(users)
      .values({
        tenantId,
        name: dto.name,
        email: dto.email,
        password: passwordHash,
        role: dto.role,
      })
      .returning({
        id: users.id,
        tenantId: users.tenantId,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return user;
  }

  /**
   * Crea el usuario tenant_admin inicial al crear un tenant.
   * Devuelve el usuario con la contraseña en texto plano — solo esta vez.
   */
  async createTenantAdmin(tenantId: string, dto: CreateUserDto) {
    const user = await this.create(tenantId, dto);
    return { ...user, password: dto.password };
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto) {
    await this.findOneInTenant(id, tenantId);

    // Construir el objeto de update explícitamente para evitar
    // pasar campos undefined a Drizzle (causa "No values to set")
    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined)     updateData['name']     = dto.name;
    if (dto.role !== undefined)     updateData['role']     = dto.role;
    if (dto.isActive !== undefined) updateData['isActive'] = dto.isActive;
    if (dto.password !== undefined) {
      updateData['password'] = await bcrypt.hash(dto.password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return this.findOneInTenant(id, tenantId);
    }

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning({
        id: users.id,
        tenantId: users.tenantId,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      });

    return updated;
  }

  async remove(id: string, tenantId: string) {
    await this.findOneInTenant(id, tenantId);
    await this.db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
  }
}
