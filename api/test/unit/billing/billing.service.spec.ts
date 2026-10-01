import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BillingService } from '../../../src/modules/billing/services/billing.service';

const mockPlanFree = {
  id: 'starter',
  name: 'Starter',
  maxFlags: 50,
  maxProjects: 1,
  maxEnvironments: 3,
  maxEvaluationsMonth: null,
  maxAssetStorageMb: null,
  hasSse: false,
  priceUsd: 0,
};

const mockPlanStudio = {
  id: 'studio',
  name: 'Studio',
  maxFlags: 500,
  maxProjects: null,
  maxEnvironments: 10,
  maxEvaluationsMonth: null,
  maxAssetStorageMb: null,
  hasSse: true,
  priceUsd: 4900,
};

const mockPlanScale = {
  id: 'scale',
  name: 'Scale',
  maxFlags: null,
  maxProjects: null,
  maxEnvironments: null,
  maxEvaluationsMonth: 1_000_000,
  maxAssetStorageMb: 5000,
  hasSse: true,
  priceUsd: 9900,
};

const mockSubscription = {
  id: 'sub-1',
  tenantId: 'tenant-1',
  planId: 'studio',
  startedAt: new Date(),
  endsAt: null,
  createdAt: new Date(),
};

const mockDb = {
  query: {
    plans: { findFirst: jest.fn(), findMany: jest.fn() },
    tenantSubscriptions: { findFirst: jest.fn(), findMany: jest.fn() },
    usageRecords: { findFirst: jest.fn(), findMany: jest.fn() },
  },
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({ returning: jest.fn() }),
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
  }),
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BillingService, { provide: 'DB', useValue: mockDb }],
    }).compile();

    service = module.get(BillingService);
    jest.clearAllMocks();
  });

  describe('findPlan', () => {
    it('returns the plan when found', async () => {
      mockDb.query.plans.findFirst.mockResolvedValue(mockPlanScale);

      const result = await service.findPlan('scale');
      expect(result).toEqual(mockPlanScale);
    });

    it('throws NotFoundException when plan does not exist', async () => {
      mockDb.query.plans.findFirst.mockResolvedValue(null);

      await expect(service.findPlan('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPlan', () => {
    it('throws ConflictException when plan already exists', async () => {
      mockDb.query.plans.findFirst.mockResolvedValue(mockPlanScale);

      await expect(
        service.createPlan({ id: 'scale', name: 'Scale', priceUsd: 9900 }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates plan when it does not exist', async () => {
      mockDb.query.plans.findFirst.mockResolvedValue(null);
      const insertReturning = jest.fn().mockResolvedValue([mockPlanScale]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: insertReturning }),
      });

      const result = await service.createPlan({
        id: 'scale',
        name: 'Scale',
        priceUsd: 9900,
      });
      expect(result).toEqual(mockPlanScale);
    });
  });

  describe('subscribe', () => {
    it('throws ConflictException when tenant is already on the same plan', async () => {
      mockDb.query.plans.findFirst.mockResolvedValue(mockPlanStudio);
      mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue(
        mockSubscription,
      );

      await expect(
        service.subscribe('tenant-1', { planId: 'studio' }),
      ).rejects.toThrow(ConflictException);
    });

    it('closes previous subscription and creates new one when changing plan', async () => {
      mockDb.query.plans.findFirst.mockResolvedValue(mockPlanScale);
      mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue(
        mockSubscription,
      );

      const newSub = { ...mockSubscription, planId: 'scale' };
      const insertReturning = jest.fn().mockResolvedValue([newSub]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({ returning: insertReturning }),
      });
      const updateWhere = jest.fn().mockResolvedValue([]);
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({ where: updateWhere }),
      });

      const result = await service.subscribe('tenant-1', { planId: 'scale' });

      expect(mockDb.update).toHaveBeenCalled();
      expect(result.planId).toBe('scale');
    });
  });

  describe('getCurrentUsage', () => {
    it('returns zero actual usage when no usage record exists', async () => {
      mockDb.query.usageRecords.findFirst.mockResolvedValue(null);
      mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue(
        mockSubscription,
      );
      mockDb.query.plans.findFirst.mockResolvedValue(mockPlanStudio);

      const result = await service.getCurrentUsage('tenant-1');

      expect(result.actual.evaluationsCount).toBe(0);
      expect(result.actual.assetStorageMb).toBe(0);
    });

    it('returns plan info when tenant has active subscription', async () => {
      mockDb.query.usageRecords.findFirst.mockResolvedValue(null);
      mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue(
        mockSubscription,
      );
      mockDb.query.plans.findFirst.mockResolvedValue(mockPlanStudio);

      const result = await service.getCurrentUsage('tenant-1');

      expect(result.plan?.id).toBe('studio');
      expect(result.plan?.baseCostUsd).toBe(49);
    });

    it('returns null plan when tenant has no subscription', async () => {
      mockDb.query.usageRecords.findFirst.mockResolvedValue(null);
      mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentUsage('tenant-1');

      expect(result.plan).toBeNull();
      expect(result.cost.totalCostUsd).toBe(0);
    });

    it('Studio plan has zero overage even with high usage', async () => {
      mockDb.query.usageRecords.findFirst.mockResolvedValue({
        evaluationsCount: 50_000_000,
        assetStorageMb: 0,
        sseConnectionsMax: 0,
      });
      mockDb.query.tenantSubscriptions.findFirst.mockResolvedValue(
        mockSubscription,
      );
      mockDb.query.plans.findFirst.mockResolvedValue(mockPlanStudio);

      const result = await service.getCurrentUsage('tenant-1');

      expect(result.cost.overageCostUsd).toBe(0);
      expect(result.cost.totalCostUsd).toBe(49);
    });
  });
});
