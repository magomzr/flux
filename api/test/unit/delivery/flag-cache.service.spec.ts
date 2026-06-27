import { Test } from '@nestjs/testing';
import { FlagCacheService } from '../../../src/modules/delivery/services/flag-cache.service';

const mockRows = [
  { key: 'checkout_v2', type: 'boolean', enabled: true, value: null },
  { key: 'banner_text', type: 'string', enabled: false, value: 'Hello' },
];

const mockDb = {
  select: jest.fn(),
  from: jest.fn(),
};

describe('FlagCacheService', () => {
  let service: FlagCacheService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [FlagCacheService, { provide: 'DB', useValue: mockDb }],
    }).compile();

    service = module.get(FlagCacheService);
    jest.clearAllMocks();

    const whereMock = jest.fn().mockResolvedValue(mockRows);
    const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock });
    const fromMock = jest.fn().mockReturnValue({ innerJoin: innerJoinMock });
    mockDb.select.mockReturnValue({ from: fromMock });
  });

  describe('getAll', () => {
    it('loads flags from DB on first call and returns payload array', async () => {
      const result = await service.getAll('env-1');

      expect(result.flags).toHaveLength(2);
      expect(result.flags.find((f) => f.key === 'checkout_v2')).toMatchObject({
        key: 'checkout_v2',
        enabled: true,
        type: 'boolean',
      });
      expect(result.etag).toBeTruthy();
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it('returns cached result on second call without hitting DB', async () => {
      await service.getAll('env-1');
      await service.getAll('env-1');

      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it('returns deterministic ETag for same flag state', async () => {
      const r1 = await service.getAll('env-1');
      service.invalidateAll();

      const whereMock = jest.fn().mockResolvedValue(mockRows);
      const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock });
      const fromMock = jest.fn().mockReturnValue({ innerJoin: innerJoinMock });
      mockDb.select.mockReturnValue({ from: fromMock });

      const r2 = await service.getAll('env-1');
      expect(r1.etag).toBe(r2.etag);
    });
  });

  describe('getOne', () => {
    it('returns specific flag by key', async () => {
      const result = await service.getOne('env-1', 'checkout_v2');

      expect(result).toMatchObject({ key: 'checkout_v2', enabled: true });
    });

    it('returns null when flag key does not exist', async () => {
      const result = await service.getOne('env-1', 'nonexistent_flag');
      expect(result).toBeNull();
    });
  });

  describe('handleFlagChanged', () => {
    it('invalidates cache for the affected environment', async () => {
      await service.getAll('env-1');
      expect(mockDb.select).toHaveBeenCalledTimes(1);

      service.handleFlagChanged({ environmentId: 'env-1' });

      await service.getAll('env-1');
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('does not affect cache of other environments', async () => {
      await service.getAll('env-1');
      await service.getAll('env-2');
      expect(mockDb.select).toHaveBeenCalledTimes(2);

      service.handleFlagChanged({ environmentId: 'env-1' });

      await service.getAll('env-2');
      expect(mockDb.select).toHaveBeenCalledTimes(2);

      await service.getAll('env-1');
      expect(mockDb.select).toHaveBeenCalledTimes(3);
    });
  });

  describe('invalidateAll', () => {
    it('clears all cached environments', async () => {
      await service.getAll('env-1');
      await service.getAll('env-2');
      expect(mockDb.select).toHaveBeenCalledTimes(2);

      service.invalidateAll();

      await service.getAll('env-1');
      await service.getAll('env-2');
      expect(mockDb.select).toHaveBeenCalledTimes(4);
    });
  });

  describe('ETag', () => {
    it('returns different ETags when flag state changes', async () => {
      const r1 = await service.getAll('env-1');
      service.invalidateAll();

      const modifiedRows = mockRows.map((r) =>
        r.key === 'checkout_v2' ? { ...r, enabled: false } : r,
      );
      const whereMock = jest.fn().mockResolvedValue(modifiedRows);
      const innerJoinMock = jest.fn().mockReturnValue({ where: whereMock });
      const fromMock = jest.fn().mockReturnValue({ innerJoin: innerJoinMock });
      mockDb.select.mockReturnValue({ from: fromMock });

      const r2 = await service.getAll('env-1');
      expect(r1.etag).not.toBe(r2.etag);
    });

    it('returns same ETag when flag state is identical', async () => {
      const etag1 = await service.getEtag('env-1');
      const etag2 = await service.getEtag('env-1');
      expect(etag1).toBe(etag2);
    });
  });
});
