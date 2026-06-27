import { Test } from '@nestjs/testing';
import { AuditService } from '../../../src/modules/audit/services/audit.service';

const mockDb = {
  insert: jest.fn(),
  query: {
    auditLogs: { findMany: jest.fn() },
  },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AuditService, { provide: 'DB', useValue: mockDb }],
    }).compile();

    service = module.get(AuditService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('inserts audit entry with correct fields', async () => {
      const valuesMock = jest.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: valuesMock });

      await service.log({
        action: 'flag.created',
        entityType: 'flag',
        entityId: 'flag-1',
        context: { userId: 'user-1', tenantId: 'tenant-1', ip: '127.0.0.1' },
        metadata: { key: 'my_flag' },
      });

      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'flag.created',
          entityType: 'flag',
          entityId: 'flag-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
          ip: '127.0.0.1',
          metadata: JSON.stringify({ key: 'my_flag' }),
        }),
      );
    });

    it('serializes metadata as JSON string', async () => {
      const valuesMock = jest.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: valuesMock });

      await service.log({
        action: 'project.updated',
        entityType: 'project',
        entityId: 'proj-1',
        context: { userId: 'user-1', tenantId: 'tenant-1' },
        metadata: { before: { name: 'Old' }, after: { name: 'New' } },
      });

      const call = valuesMock.mock.calls[0][0];
      expect(typeof call.metadata).toBe('string');
      expect(JSON.parse(call.metadata)).toEqual({
        before: { name: 'Old' },
        after: { name: 'New' },
      });
    });

    it('stores null metadata when not provided', async () => {
      const valuesMock = jest.fn().mockResolvedValue([]);
      mockDb.insert.mockReturnValue({ values: valuesMock });

      await service.log({
        action: 'tenant.deactivated',
        entityType: 'tenant',
        entityId: 'tenant-1',
        context: { userId: 'user-1', tenantId: null },
      });

      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: null }),
      );
    });

    it('never throws — swallows DB errors silently', async () => {
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      });

      await expect(
        service.log({
          action: 'flag.created' as any,
          entityType: 'flag',
          entityId: 'flag-1',
          context: { userId: 'user-1', tenantId: 'tenant-1' },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('query', () => {
    const rawRows = [
      {
        id: 'log-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'flag.created',
        entityType: 'flag',
        entityId: 'flag-1',
        metadata: JSON.stringify({ key: 'my_flag' }),
        ip: '127.0.0.1',
        createdAt: new Date(),
      },
      {
        id: 'log-2',
        tenantId: 'tenant-1',
        userId: null,
        action: 'tenant.deactivated',
        entityType: 'tenant',
        entityId: 'tenant-1',
        metadata: null,
        ip: null,
        createdAt: new Date(),
      },
    ];

    it('returns logs with parsed metadata', async () => {
      mockDb.query.auditLogs.findMany.mockResolvedValue(rawRows);

      const results = await service.query({ tenantId: 'tenant-1' });

      expect(results).toHaveLength(2);
      expect(results[0].metadata).toEqual({ key: 'my_flag' });
      expect(results[1].metadata).toBeNull();
    });

    it('applies default limit of 50', async () => {
      mockDb.query.auditLogs.findMany.mockResolvedValue([]);

      await service.query({ tenantId: 'tenant-1' });

      expect(mockDb.query.auditLogs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 0 }),
      );
    });

    it('respects custom limit and offset', async () => {
      mockDb.query.auditLogs.findMany.mockResolvedValue([]);

      await service.query({ tenantId: 'tenant-1', limit: 10, offset: 20 });

      expect(mockDb.query.auditLogs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 }),
      );
    });
  });
});
