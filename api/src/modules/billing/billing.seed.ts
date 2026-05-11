import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { plans } from '../../db/schema';
import type { Db } from '../../db';

/**
 * Definición canónica de los planes de Flux.
 *
 * Para modificar un plan (precios, límites, features):
 *   1. Edita los valores aquí
 *   2. Haz commit con un mensaje descriptivo ("feat: increase Starter maxProjects to 2")
 *   3. Reinicia el servidor — el upsert actualiza la DB automáticamente
 *
 * Los cambios quedan versionados en git con historial completo.
 */
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    maxFlags: 50,
    maxProjects: 1,
    maxEnvironments: 3,
    maxEvaluationsMonth: null as number | null,
    maxAssetStorageMb: null as number | null,
    hasSse: false,
    pollIntervalSeconds: 60,
    priceUsd: 0,
  },
  {
    id: 'studio',
    name: 'Studio',
    maxFlags: 500,
    maxProjects: null as number | null,
    maxEnvironments: 10,
    maxEvaluationsMonth: null as number | null,
    maxAssetStorageMb: null as number | null,
    hasSse: true,
    pollIntervalSeconds: 10,
    priceUsd: 4900,
  },
  {
    id: 'scale',
    name: 'Scale',
    maxFlags: null as number | null,
    maxProjects: null as number | null,
    maxEnvironments: null as number | null,
    maxEvaluationsMonth: 1_000_000,
    maxAssetStorageMb: 5000,
    hasSse: true,
    pollIntervalSeconds: 5,
    priceUsd: 9900,
  },
] as const;

@Injectable()
export class BillingSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingSeed.name);

  constructor(@Inject('DB') private readonly db: Db) {}

  async onApplicationBootstrap() {
    let upserted = 0;

    for (const plan of PLANS) {
      await this.db
        .insert(plans)
        .values(plan)
        .onConflictDoUpdate({
          target: plans.id,
          set: {
            name:                 sql`excluded.name`,
            maxFlags:             sql`excluded.max_flags`,
            maxProjects:          sql`excluded.max_projects`,
            maxEnvironments:      sql`excluded.max_environments`,
            maxEvaluationsMonth:  sql`excluded.max_evaluations_month`,
            maxAssetStorageMb:    sql`excluded.max_asset_storage_mb`,
            hasSse:               sql`excluded.has_sse`,
            pollIntervalSeconds:  sql`excluded.poll_interval_seconds`,
            priceUsd:             sql`excluded.price_usd`,
          },
        });

      upserted++;
    }

    this.logger.log(`Plans synced (${upserted}): ${PLANS.map((p) => p.id).join(', ')}`);
  }
}
