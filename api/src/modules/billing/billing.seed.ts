import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { plans } from '../../db/schema';
import type { Db } from '../../db';

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
    priceUsd: 0,
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
            name: sql`excluded.name`,
            maxFlags: sql`excluded.max_flags`,
            maxProjects: sql`excluded.max_projects`,
            maxEnvironments: sql`excluded.max_environments`,
            maxEvaluationsMonth: sql`excluded.max_evaluations_month`,
            maxAssetStorageMb: sql`excluded.max_asset_storage_mb`,
            hasSse: sql`excluded.has_sse`,
            priceUsd: sql`excluded.price_usd`,
          },
        });

      upserted++;
    }

    this.logger.log(
      `Plans synced (${upserted}): ${PLANS.map((p) => p.id).join(', ')}`,
    );
  }
}
