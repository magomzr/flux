import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or, gt } from 'drizzle-orm';
import { plans, tenantSubscriptions, usageRecords } from '../../../db/schema';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { SubscribeDto } from '../dto/subscribe.dto';
import type { CostEstimateDto } from '../dto/cost-estimate.dto';
import type { Db } from '../../../db';

const OVERAGE = {
  evaluationsPer1k: 1,
  storageMbPerMonth: 2,
} as const;

const FLAT_RATE_PLANS = new Set(['starter', 'studio']);

@Injectable()
export class BillingService {
  constructor(@Inject('DB') private readonly db: Db) {}

  async createPlan(dto: CreatePlanDto) {
    const existing = await this.db.query.plans.findFirst({
      where: eq(plans.id, dto.id),
    });

    if (existing) {
      throw new ConflictException(`Plan "${dto.id}" already exists`);
    }

    const [plan] = await this.db
      .insert(plans)
      .values({
        id: dto.id,
        name: dto.name,
        maxFlags: dto.maxFlags ?? null,
        maxProjects: dto.maxProjects ?? null,
        maxEnvironments: dto.maxEnvironments ?? null,
        maxEvaluationsMonth: dto.maxEvaluationsMonth ?? null,
        maxAssetStorageMb: dto.maxAssetStorageMb ?? null,
        hasSse: dto.hasSse ?? false,
        priceUsd: dto.priceUsd ?? 0,
      })
      .returning();

    return plan;
  }

  async findAllPlans() {
    return this.db.query.plans.findMany();
  }

  async findPlan(id: string) {
    const plan = await this.db.query.plans.findFirst({
      where: eq(plans.id, id),
    });

    if (!plan) throw new NotFoundException(`Plan "${id}" not found`);

    return plan;
  }

  async subscribe(tenantId: string, dto: SubscribeDto) {
    await this.findPlan(dto.planId);

    const active = await this.getActiveSubscription(tenantId);

    if (active?.planId === dto.planId) {
      throw new ConflictException(`Tenant is already on plan "${dto.planId}"`);
    }

    if (active) {
      await this.db
        .update(tenantSubscriptions)
        .set({ endsAt: new Date() })
        .where(eq(tenantSubscriptions.id, active.id));
    }

    const [subscription] = await this.db
      .insert(tenantSubscriptions)
      .values({ tenantId, planId: dto.planId })
      .returning();

    return subscription;
  }

  async getActiveSubscription(tenantId: string) {
    const now = new Date();

    return this.db.query.tenantSubscriptions.findFirst({
      where: and(
        eq(tenantSubscriptions.tenantId, tenantId),
        or(
          isNull(tenantSubscriptions.endsAt),
          gt(tenantSubscriptions.endsAt, now),
        ),
      ),
      orderBy: desc(tenantSubscriptions.startedAt),
    });
  }

  async getSubscriptionHistory(tenantId: string) {
    return this.db.query.tenantSubscriptions.findMany({
      where: eq(tenantSubscriptions.tenantId, tenantId),
      orderBy: desc(tenantSubscriptions.startedAt),
    });
  }

  async getActivePlan(tenantId: string) {
    const subscription = await this.getActiveSubscription(tenantId);

    if (!subscription) return null;

    return this.findPlan(subscription.planId);
  }

  async getCurrentUsage(tenantId: string) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const usageRecord = await this.db.query.usageRecords.findFirst({
      where: and(
        eq(usageRecords.tenantId, tenantId),
        eq(usageRecords.periodStart, periodStart),
      ),
    });

    const plan = await this.getActivePlan(tenantId);

    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const dayOfMonth = now.getDate();
    const monthFraction = Math.max(dayOfMonth, 1) / daysInMonth;

    const actualEvaluations = usageRecord?.evaluationsCount ?? 0;
    const actualStorageMb = usageRecord?.assetStorageMb ?? 0;
    const actualSseMax = usageRecord?.sseConnectionsMax ?? 0;

    const projectedEvaluations = Math.ceil(actualEvaluations / monthFraction);
    const projectedStorageMb = actualStorageMb;
    const projectedSseMax = actualSseMax;

    let baseCostUsd = 0;
    let overageCostUsd = 0;
    const breakdown: Record<string, number> = {};

    if (plan) {
      baseCostUsd = plan.priceUsd / 100;

      if (!FLAT_RATE_PLANS.has(plan.id)) {
        if (
          plan.maxEvaluationsMonth !== null &&
          projectedEvaluations > plan.maxEvaluationsMonth
        ) {
          const extra = projectedEvaluations - plan.maxEvaluationsMonth;
          const cost =
            Math.ceil(extra / 1000) * (OVERAGE.evaluationsPer1k / 100);
          overageCostUsd += cost;
          breakdown['evaluations_overage_usd'] = cost;
        }

        if (
          plan.maxAssetStorageMb !== null &&
          projectedStorageMb > plan.maxAssetStorageMb
        ) {
          const extra = projectedStorageMb - plan.maxAssetStorageMb;
          const cost = extra * (OVERAGE.storageMbPerMonth / 100);
          overageCostUsd += cost;
          breakdown['storage_overage_usd'] = cost;
        }
      }
    }

    return {
      period: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        dayOfMonth,
        daysInMonth,
        percentElapsed: Math.round(monthFraction * 100),
      },
      plan: plan ? { id: plan.id, name: plan.name, baseCostUsd } : null,
      actual: {
        evaluationsCount: actualEvaluations,
        assetStorageMb: actualStorageMb,
        sseConnectionsMax: actualSseMax,
      },
      projected: {
        evaluationsCount: projectedEvaluations,
        assetStorageMb: projectedStorageMb,
        sseConnectionsMax: projectedSseMax,
      },
      cost: {
        baseCostUsd,
        overageCostUsd: Math.round(overageCostUsd * 100) / 100,
        totalCostUsd: Math.round((baseCostUsd + overageCostUsd) * 100) / 100,
        breakdown,
      },
    };
  }

  async getUsageHistory(tenantId: string) {
    return this.db.query.usageRecords.findMany({
      where: eq(usageRecords.tenantId, tenantId),
      orderBy: desc(usageRecords.periodStart),
    });
  }

  async calculateCost(dto: CostEstimateDto) {
    const allPlans = await this.findAllPlans();

    return allPlans.map((plan) => {
      const baseCostUsd = plan.priceUsd / 100;
      let overageCostUsd = 0;
      const breakdown: Record<string, number> = {};

      const evalUsage = dto.evaluationsMonth ?? 0;
      if (
        !FLAT_RATE_PLANS.has(plan.id) &&
        plan.maxEvaluationsMonth !== null &&
        evalUsage > plan.maxEvaluationsMonth
      ) {
        const extra = evalUsage - plan.maxEvaluationsMonth;
        const cost = Math.ceil(extra / 1000) * (OVERAGE.evaluationsPer1k / 100);
        overageCostUsd += cost;
        breakdown['evaluations_overage_usd'] = cost;
      }

      const sseUsage = dto.sseConnectionsMax ?? 0;
      if (!plan.hasSse && sseUsage > 0) {
        breakdown['sse_not_available'] = 0;
      }

      const storageUsage = dto.assetStorageMb ?? 0;
      if (
        !FLAT_RATE_PLANS.has(plan.id) &&
        plan.maxAssetStorageMb !== null &&
        storageUsage > plan.maxAssetStorageMb
      ) {
        const extra = storageUsage - plan.maxAssetStorageMb;
        const cost = extra * (OVERAGE.storageMbPerMonth / 100);
        overageCostUsd += cost;
        breakdown['storage_overage_usd'] = cost;
      }

      return {
        planId: plan.id,
        planName: plan.name,
        baseCostUsd,
        overageCostUsd: Math.round(overageCostUsd * 100) / 100,
        totalCostUsd: Math.round((baseCostUsd + overageCostUsd) * 100) / 100,
        hasSse: plan.hasSse,
        breakdown,
      };
    });
  }
}
