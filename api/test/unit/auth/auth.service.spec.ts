import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/modules/auth/services/auth.service';
import { UsersService } from '../../../src/modules/users/services/users.service';

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@flux.com',
  password: 'hashed-password',
  role: 'tenant_admin',
  tenantId: 'tenant-1',
  isActive: true,
  createdAt: new Date(),
  lastLoginAt: null,
};

const mockRefreshToken = {
  id: 'rt-1',
  userId: 'user-1',
  tokenHash: 'hashed-token',
  familyId: 'family-1',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date(),
};

const mockDb = {
  insert: jest
    .fn()
    .mockReturnValue({ values: jest.fn().mockResolvedValue([]) }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
  }),
  query: {
    refreshTokens: {
      findMany: jest.fn(),
    },
  },
};

const mockUsersService = {
  validateCredentials: jest.fn(),
  getPermissions: jest.fn().mockReturnValue(['read:flag', 'write:flag']),
  findById: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: 'DB', useValue: mockDb },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('returns access_token and refresh_token on valid credentials', async () => {
      mockUsersService.validateCredentials.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-rt');

      const result = await service.login({
        email: 'test@flux.com',
        password: 'pass',
      });

      expect(result).toHaveProperty('access_token', 'mock-access-token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockUsersService.validateCredentials).toHaveBeenCalledWith({
        email: 'test@flux.com',
        password: 'pass',
      });
    });

    it('throws UnauthorizedException when credentials are invalid', async () => {
      mockUsersService.validateCredentials.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        service.login({ email: 'bad@flux.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('returns new tokens when refresh token is valid', async () => {
      mockDb.query.refreshTokens.findMany.mockResolvedValue([mockRefreshToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      mockUsersService.findById.mockResolvedValue(mockUser);

      const rawToken = `${mockUser.id}:abc123`;
      const result = await service.refresh(rawToken);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('throws when refresh token is not found', async () => {
      mockDb.query.refreshTokens.findMany.mockResolvedValue([]);

      await expect(service.refresh('user-1:nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws and revokes family when token is already revoked', async () => {
      const revokedToken = { ...mockRefreshToken, revokedAt: new Date() };
      mockDb.query.refreshTokens.findMany.mockResolvedValue([revokedToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const updateMock = {
        set: jest
          .fn()
          .mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      };
      mockDb.update.mockReturnValue(updateMock);

      await expect(service.refresh(`${mockUser.id}:token`)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when refresh token is expired', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockDb.query.refreshTokens.findMany.mockResolvedValue([expiredToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.refresh(`${mockUser.id}:token`)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when user is inactive', async () => {
      mockDb.query.refreshTokens.findMany.mockResolvedValue([mockRefreshToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      mockUsersService.findById.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const updateMock = {
        set: jest
          .fn()
          .mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      };
      mockDb.update.mockReturnValue(updateMock);

      await expect(service.refresh(`${mockUser.id}:token`)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the token family when token is found', async () => {
      mockDb.query.refreshTokens.findMany.mockResolvedValue([mockRefreshToken]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const updateMock = {
        set: jest
          .fn()
          .mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      };
      mockDb.update.mockReturnValue(updateMock);

      await service.logout(`${mockUser.id}:token`);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('does nothing when token is not found', async () => {
      mockDb.query.refreshTokens.findMany.mockResolvedValue([]);

      await expect(service.logout('user-1:unknown')).resolves.toBeUndefined();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('updates password when current password is correct', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const updateMock = {
        set: jest
          .fn()
          .mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
      };
      mockDb.update.mockReturnValue(updateMock);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'old-pass',
          newPassword: 'NewPass123!',
        }),
      ).resolves.toBeUndefined();

      expect(updateMock.set).toHaveBeenCalledWith({ password: 'new-hash' });
    });

    it('throws when current password is incorrect', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong',
          newPassword: 'NewPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when user is not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', {
          currentPassword: 'pass',
          newPassword: 'NewPass123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
