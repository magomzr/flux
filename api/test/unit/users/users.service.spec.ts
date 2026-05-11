import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';
import { UsersService } from '../../../src/modules/users/services/users.service';
import { ROLE_PERMISSIONS } from '../../../src/common/config/roles.config';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  name: 'Jane Doe',
  email: 'jane@acme.com',
  password: '$2b$10$hashed',
  role: 'developer',
  isActive: true,
  createdAt: new Date(),
  lastLoginAt: null,
};

const mockUserSafe = {
  id: 'user-1',
  tenantId: 'tenant-1',
  name: 'Jane Doe',
  email: 'jane@acme.com',
  role: 'developer',
  isActive: true,
  createdAt: new Date(),
  lastLoginAt: null,
};

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockDb = {
  query: {
    users: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: 'DB', useValue: mockDb }],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  // ─── getPermissions ──────────────────────────────────────────────────────────

  describe('getPermissions', () => {
    it('returns correct permissions for tenant_admin', () => {
      const perms = service.getPermissions('tenant_admin');
      expect(perms).toContain('read:flag');
      expect(perms).toContain('write:flag');
      expect(perms).toContain('publish:flag');
      expect(perms).toContain('read:billing');
      expect(perms).toContain('write:user');
    });

    it('returns correct permissions for developer', () => {
      const perms = service.getPermissions('developer');
      expect(perms).toContain('read:flag');
      expect(perms).toContain('write:flag');
      expect(perms).not.toContain('read:billing');
      expect(perms).not.toContain('write:user');
    });

    it('returns correct permissions for viewer — read only', () => {
      const perms = service.getPermissions('viewer');
      expect(perms).toContain('read:flag');
      expect(perms).not.toContain('write:flag');
      expect(perms).not.toContain('publish:flag');
    });

    it('returns empty array for unknown role', () => {
      const perms = service.getPermissions('unknown_role');
      expect(perms).toEqual([]);
    });

    it('super_admin has all permissions', () => {
      const perms = service.getPermissions('super_admin');
      const allPerms = Object.values(ROLE_PERMISSIONS).flat();
      const uniquePerms = [...new Set(allPerms)];
      uniquePerms.forEach((p) => expect(perms).toContain(p));
    });
  });

  // ─── validateCredentials ─────────────────────────────────────────────────────

  describe('validateCredentials', () => {
    it('returns user when credentials are valid', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateCredentials({
        email: 'jane@acme.com',
        password: 'correct-pass',
      });

      expect(result).toEqual(mockUser);
    });

    it('throws when user is not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(
        service.validateCredentials({
          email: 'nobody@acme.com',
          password: 'pass',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when password does not match', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateCredentials({
          email: 'jane@acme.com',
          password: 'wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('hashes password and inserts user', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null); // email not taken
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');

      const returningMock = jest.fn().mockResolvedValue([mockUserSafe]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });

      const result = await service.create('tenant-1', {
        name: 'Jane Doe',
        email: 'jane@acme.com',
        password: 'plain-pass',
        role: 'developer',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('plain-pass', 10);
      expect(result.email).toBe('jane@acme.com');
      // password nunca se devuelve
      expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException when email is already taken', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.create('tenant-1', {
          name: 'Jane',
          email: 'jane@acme.com',
          password: 'pass',
          role: 'developer',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── createTenantAdmin ───────────────────────────────────────────────────────

  describe('createTenantAdmin', () => {
    it('returns user with plain password — only this once', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');

      const returningMock = jest.fn().mockResolvedValue([mockUserSafe]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });

      const result = await service.createTenantAdmin('tenant-1', {
        name: 'Admin',
        email: 'admin@acme.com',
        password: 'PlainPass123!',
        role: 'tenant_admin',
      });

      // La contraseña en texto plano debe estar en la respuesta
      expect(result.password).toBe('PlainPass123!');
    });
  });

  // ─── findOneInTenant ─────────────────────────────────────────────────────────

  describe('findOneInTenant', () => {
    it('returns user when found in tenant', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUserSafe);

      const result = await service.findOneInTenant('user-1', 'tenant-1');
      expect(result.id).toBe('user-1');
    });

    it('throws NotFoundException when user not in tenant', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneInTenant('user-1', 'other-tenant'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('hashes new password when provided', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUserSafe);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-pw');

      const updatedUser = { ...mockUserSafe, role: 'editor' };
      const whereMock = jest.fn().mockResolvedValue([updatedUser]);
      mockDb.update.mockReturnValue({
        set: jest
          .fn()
          .mockReturnValue({
            where: jest.fn().mockReturnValue({ returning: whereMock }),
          }),
      });

      await service.update('user-1', 'tenant-1', { password: 'NewPass123!' });

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123!', 10);
    });

    it('does not call bcrypt when password is not in dto', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUserSafe);

      const whereMock = jest
        .fn()
        .mockResolvedValue([{ ...mockUserSafe, role: 'editor' }]);
      mockDb.update.mockReturnValue({
        set: jest
          .fn()
          .mockReturnValue({
            where: jest.fn().mockReturnValue({ returning: whereMock }),
          }),
      });

      await service.update('user-1', 'tenant-1', { role: 'editor' });

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes user when found in tenant', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUserSafe);
      const whereMock = jest.fn().mockResolvedValue([]);
      mockDb.delete.mockReturnValue({ where: whereMock });

      await service.remove('user-1', 'tenant-1');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException when user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
