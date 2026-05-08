import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { usageRecords } from '../../../db/schema';
import type { Db } from '../../../db';

/**
 * Contador de evaluaciones en memoria con flush periódico a DB.
 *
 * Por qué así:
 * - Cada GET /sdk/flags no puede hacer un write a DB — mataría el throughput.
 * - Acumulamos en un Map en memoria y flusheamos cada FLUSH_INTERVAL_MS.
 * - Si el proceso muere entre flushes, se pierden esos conteos — aceptable
 *   para métricas de billing (el error es pequeño y predecible).
 */
@Injectable()
export class UsageCounterService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(UsageCounterService.name);

  /** Map<tenantId, evaluationCount> — acumulador en memoria */
  private readonly counters = new Map<string, number>();

  private flushTimer: NodeJS.Timeout | null = null;

  // Flush cada 30 segundos — balance entre precisión y carga en DB
  private readonly FLUSH_INTERVAL_MS = 30_000;

  constructor(@Inject('DB') private readonly db: Db) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  async onApplicationShutdown() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    // Flush final antes de apagar
    await this.flush();
  }

  /**
   * Incrementa el contador de evaluaciones para un tenant.
   * Operación síncrona O(1) — no bloquea el request.
   */
  increment(tenantId: string, count = 1): void {
    const current = this.counters.get(tenantId) ?? 0;
    this.counters.set(tenantId, current + count);
  }

  /**
   * Escribe los contadores acumulados en DB usando upsert.
   * Se ejecuta en background — nunca bloquea requests.
   */
  async flush(): Promise<void> {
    if (this.counters.size === 0) return;

    // Snapshot y limpiar antes del write para no perder conteos
    // que lleguen durante el flush
    const snapshot = new Map(this.counters);
    this.counters.clear();

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

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
    // Intentar actualizar primero
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

    // Si no existe el registro del período, crearlo
    if (updated.length === 0) {
      await this.db.insert(usageRecords).values({
        tenantId,
        periodStart,
        periodEnd,
        evaluationsCount: count,
      }).onConflictDoNothing();
    }
  }
}
