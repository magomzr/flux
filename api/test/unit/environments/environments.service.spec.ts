import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EnvironmentsService } from '../../../src/modules/environments/services/environments.service';
import { AuditService } from '../../../src/modules/audit/services/audit.service';

const ctx = { userId: 'user-1', tenantId: 'tenant-1', ip: '127.0.0.1' };

const mockEnv = {
  id: 'env-1',
  projectId: 'project-1',
  name: 'Production',
  slug: 'production',
  color: '#ef4444',
  isDefault: false,
  createdAt: new Date(),
};

const mockDb = {
  query: {
    environments: { findFirst: jest.fn(), findMany: jest.fn() },
    flags: { findMany: jest.fn().mockResolvedValue([]) },
  },
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

describe('EnvironmentsService', () => {
  let service: EnvironmentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EnvironmentsService,
        { provide: 'DB', useValue: mockDb },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(EnvironmentsService);
    jest.clearAllMocks();

    mockDb.query.flags.findMany.mockResolvedValue([]);
    mockAudit.log.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('creates environment and logs audit', async () => {
      mockDb.query.environments.findFirst.mockResolvedValue(null);
      const returningMock = jest.fn().mockResolvedValue([mockEnv]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });

      const result = await service.create(
        'project-1',
        {
          name: 'Production',
          slug: 'production',
          color: '#ef4444',
        },
        ctx,
      );

      expect(result.slug).toBe('production');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'environment.created' }),
      );
    });

    it('clears previous default before creating new default environment', async () => {
      mockDb.query.environments.findFirst.mockResolvedValue(null);
      const returningMock = jest
        .fn()
        .mockResolvedValue([{ ...mockEnv, isDefault: true }]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });
      const clearWhere = jest.fn().mockResolvedValue([]);
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({ where: clearWhere }),
      });

      await service.create(
        'project-1',
        {
          name: 'Dev',
          slug: 'dev',
          isDefault: true,
        },
        ctx,
      );

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('does NOT call clearDefault when isDefault is false', async () => {
      mockDb.query.environments.findFirst.mockResolvedValue(null);
      const returningMock = jest.fn().mockResolvedValue([mockEnv]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: returningMock }),
      });

      await service.create(
        'project-1',
        { name: 'Staging', slug: 'staging' },
        ctx,
      );

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when slug is taken in project', async () => {
      mockDb.query.environments.findFirst.mockResolvedValue(mockEnv);

      await expect(
        service.create('project-1', { name: 'Dup', slug: 'production' }, ctx),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('returns environment when found', async () => {
      mockDb.query.environments.findFirst.mockResolvedValue(mockEnv);
      const result = await service.findOne('env-1');
      expect(result.slug).toBe('production');
    });

    it('throws NotFoundException when not found', async () => {
      mockDb.query.environments.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('clears previous default when updating to isDefault=true', async () => {
      mockDb.query.environments.findFirst.mockResolvedValue(mockEnv);
      const clearWhere = jest.fn().mockResolvedValue([]);
      const updateReturning = jest
        .fn()
        .mockResolvedValue([{ ...mockEnv, isDefault: true }]);
      mockDb.update
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValue({ where: clearWhere }),
        })
        .mockReturnValueOnce({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({ returning: updateReturning }),
          }),
        });

      await service.update('env-1', { isDefault: true }, ctx);

      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('removePermanently', () => {
    it('deletes environment and logs audit', async () => {
      mockDb.query.environments.findFirst.mockResolvedValue(mockEnv);
      mockDb.delete.mockReturnValue({ where: jest.fn().mockResolvedValue([]) });

      await service.removePermanently('env-1', ctx);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'environment.deleted' }),
      );
    });
  });
});
