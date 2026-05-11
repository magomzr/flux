import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenantsService } from '../../../src/modules/tenants/services/tenants.service';
import { AuditService } from '../../../src/modules/audit/services/audit.service';
import { UsersService } from '../../../src/modules/users/services/users.service';

const ctx = { userId: 'super-1', tenantId: null, ip: '127.0.0.1' };

const mockTenant = {
  id: 'tenant-1',
  name: 'Acme Corp',
  slug: 'acme',
  email: 'admin@acme.com',
  logoUrl: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAdminUser = {
  id: 'user-1',
  name: 'Acme Admin',
  email: 'admin@acme.com',
  role: 'tenant_admin',
  password: 'PlainPass123!',
  isActive: true,
  createdAt: new Date(),
};

const mockDb = {
  query: { tenants: { findFirst: jest.fn(), findMany: jest.fn() } },
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockUsersService = { createTenantAdmin: jest.fn() };

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: 'DB', useValue: mockDb },
        { provide: AuditService, useValue: mockAudit },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get(TenantsService);
    jest.clearAllMocks();
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates tenant and tenant_admin, returns both with plain password', async () => {
      mockDb.query.tenants.findFirst.mockResolvedValue(null);
      const returningMock = jest.fn().mockResolvedValue([mockTenant]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });
      mockUsersService.createTenantAdmin.mockResolvedValue(mockAdminUser);

      const result = await service.create(
        {
          name: 'Acme Corp',
          slug: 'acme',
          email: 'admin@acme.com',
          admin: {
            name: 'Acme Admin',
            email: 'admin@acme.com',
            password: 'PlainPass123!',
          },
        },
        ctx,
      );

      expect(result.slug).toBe('acme');
      expect(result.admin.password).toBe('PlainPass123!');
      expect(mockUsersService.createTenantAdmin).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ role: 'tenant_admin' }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'tenant.created' }),
      );
    });

    it('throws ConflictException when slug is already taken', async () => {
      mockDb.query.tenants.findFirst.mockResolvedValue(mockTenant);

      await expect(
        service.create(
          {
            name: 'Acme 2',
            slug: 'acme',
            email: 'other@acme.com',
            admin: {
              name: 'Admin',
              email: 'admin2@acme.com',
              password: 'Pass123!',
            },
          },
          ctx,
        ),
      ).rejects.toThrow(ConflictException);

      expect(mockUsersService.createTenantAdmin).not.toHaveBeenCalled();
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns tenant when found', async () => {
      mockDb.query.tenants.findFirst.mockResolvedValue(mockTenant);
      const result = await service.findOne('tenant-1');
      expect(result.slug).toBe('acme');
    });

    it('throws NotFoundException when not found', async () => {
      mockDb.query.tenants.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deactivate ──────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('sets isActive to false and logs audit', async () => {
      mockDb.query.tenants.findFirst.mockResolvedValue(mockTenant);
      const deactivated = { ...mockTenant, isActive: false };
      const whereMock = jest.fn().mockResolvedValue([deactivated]);
      mockDb.update.mockReturnValue({
        set: jest
          .fn()
          .mockReturnValue({
            where: jest.fn().mockReturnValue({ returning: whereMock }),
          }),
      });

      const result = await service.deactivate('tenant-1', ctx);

      expect(result.isActive).toBe(false);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'tenant.deactivated' }),
      );
    });
  });

  // ─── removePermanently ───────────────────────────────────────────────────────

  describe('removePermanently', () => {
    it('deletes tenant and logs audit', async () => {
      mockDb.query.tenants.findFirst.mockResolvedValue(mockTenant);
      const whereMock = jest.fn().mockResolvedValue([]);
      mockDb.delete.mockReturnValue({ where: whereMock });

      await service.removePermanently('tenant-1', ctx);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'tenant.deleted' }),
      );
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      mockDb.query.tenants.findFirst.mockResolvedValue(null);
      await expect(
        service.removePermanently('nonexistent', ctx),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
