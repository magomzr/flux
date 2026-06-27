import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { usageRecords } from '../../../db/schema';
import type { Db } from '../../../db';

@Injectable()
export class UsageCounterService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(UsageCounterService.name);

  private readonly counters = new Map<string, number>();

  private flushTimer: NodeJS.Timeout | null = null;

  private readonly FLUSH_INTERVAL_MS = 30_000;

  constructor(@Inject('DB') private readonly db: Db) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  async onApplicationShutdown() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }

  increment(tenantId: string, count = 1): void {
    const current = this.counters.get(tenantId) ?? 0;
    this.counters.set(tenantId, current + count);
  }

  async flush(): Promise<void> {
    if (this.counters.size === 0) return;

    const snapshot = new Map(this.counters);
    this.counters.clear();

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const writes = [...snapshot.entries()].map(([tenantId, count]) =>
      this.upsertUsage(tenantId, periodStart, periodEnd, count),
    );

    const results = await Promise.allSettled(writes);

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error('Failed to flush usage counter', result.reason);
      }
    }

    this.logger.debug(`Flushed usage counters for ${snapshot.size} tenant(s)`);
  }

  private async upsertUsage(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    count: number,
  ): Promise<void> {
    const updated = await this.db
      .update(usageRecords)
      .set({
        evaluationsCount: sql`${usageRecords.evaluationsCount} + ${count}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(usageRecords.tenantId, tenantId),
          eq(usageRecords.periodStart, periodStart),
        ),
      )
      .returning({ id: usageRecords.id });

    if (updated.length === 0) {
      await this.db
        .insert(usageRecords)
        .values({
          tenantId,
          periodStart,
          periodEnd,
          evaluationsCount: count,
        })
        .onConflictDoNothing();
    }
  }
}
