import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BillingService } from '../../../src/modules/billing/services/billing.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockPlanFree = {
  id: 'starter',
  name: 'Starter',
  maxFlags: 50,
  maxProjects: 1,
  maxEnvironments: 3,
  maxEvaluationsMonth: null,
  maxAssetStorageMb: null,
  hasSse: false,
  pollIntervalSeconds: 60,
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
  pollIntervalSeconds: 10,
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
  pollIntervalSeconds: 5,
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

// ─── Mock DB ──────────────────────────────────────────────────────────────────

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

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BillingService, { provide: 'DB', useValue: mockDb }],
    }).compile();

    service = module.get(BillingService);
    jest.clearAllMocks();
  });

  // ─── Plans ──────────────────────────────────────────────────────────────────

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

  // ─── Subscriptions ──────────────────────────────────────────────────────────

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
      ); // studio activo

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

      expect(mockDb.update).toHaveBeenCalled(); // cerró la suscripción anterior
      expect(result.planId).toBe('scale');
    });
  });

  // ─── calculateCost — overage logic ──────────────────────────────────────────

  describe('calculateCost', () => {
    beforeEach(() => {
      mockDb.query.plans.findMany.mockResolvedValue([
        mockPlanFree,
        mockPlanStudio,
        mockPlanScale,
      ]);
    });

    it('Starter and Studio have zero overage regardless of evaluations', async () => {
      const results = await service.calculateCost({
        evaluationsMonth: 10_000_000,
      });

      const starter = results.find((r) => r.planId === 'starter');
      const studio = results.find((r) => r.planId === 'studio');

      expect(starter?.overageCostUsd).toBe(0);
      expect(studio?.overageCostUsd).toBe(0);
    });

    it('Scale has overage when evaluations exceed the limit', async () => {
      // Scale limit: 1M evaluations. Sending 2M → 1M overage → $10
      const results = await service.calculateCost({
        evaluationsMonth: 2_000_000,
      });

      const scale = results.find((r) => r.planId === 'scale');
      expect(scale?.overageCostUsd).toBeGreaterThan(0);
      // 1M extra / 1000 * $0.01 = $10
      expect(scale?.overageCostUsd).toBe(10);
    });

    it('Scale has no overage when evaluations are within the limit', async () => {
      const results = await service.calculateCost({
        evaluationsMonth: 500_000,
      });

      const scale = results.find((r) => r.planId === 'scale');
      expect(scale?.overageCostUsd).toBe(0);
      expect(scale?.totalCostUsd).toBe(99); // solo base
    });

    it('Scale has storage overage when storage exceeds limit', async () => {
      // Scale limit: 5000 MB. Sending 6000 MB → 1000 MB overage → $20
      const results = await service.calculateCost({ assetStorageMb: 6000 });

      const scale = results.find((r) => r.planId === 'scale');
      expect(scale?.overageCostUsd).toBe(20);
    });

    it('Scale accumulates both evaluation and storage overage', async () => {
      const results = await service.calculateCost({
        evaluationsMonth: 2_000_000, // +$10
        assetStorageMb: 6000, // +$20
      });

      const scale = results.find((r) => r.planId === 'scale');
      expect(scale?.overageCostUsd).toBe(30);
      expect(scale?.totalCostUsd).toBe(129); // $99 + $30
    });

    it('returns correct base cost for each plan', async () => {
      const results = await service.calculateCost({});

      expect(results.find((r) => r.planId === 'starter')?.baseCostUsd).toBe(0);
      expect(results.find((r) => r.planId === 'studio')?.baseCostUsd).toBe(49);
      expect(results.find((r) => r.planId === 'scale')?.baseCostUsd).toBe(99);
    });
  });

  // ─── getCurrentUsage ─────────────────────────────────────────────────────────

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
