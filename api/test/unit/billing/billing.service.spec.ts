import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BillingService } from '../../../src/modules/billing/services/billing.service';

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
