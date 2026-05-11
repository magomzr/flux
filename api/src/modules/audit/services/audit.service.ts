import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { auditLogs } from '../../../db/schema';
import type { Db } from '../../../db';
import type { AuditEntry } from '../audit.types';

export interface AuditQueryOptions {
  tenantId: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject('DB') private readonly db: Db) {}

  /**
   * Registra una acción en el log de auditoría.
   * Nunca lanza — un fallo de audit no debe interrumpir la operación principal.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        userId: entry.context.userId ?? null,
        userEmail: entry.context.userEmail ?? null,
        tenantId: entry.context.tenantId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip: entry.context.ip ?? null,
      });
    } catch (err) {
      // El audit log nunca debe romper el flujo principal
      this.logger.error(
        `Failed to write audit log [${entry.action}] for ${entry.entityType}:${entry.entityId}`,
        err,
      );
    }
  }

  /**
   * Consulta el historial de auditoría de un tenant.
   * Solo lectura — el audit log es inmutable.
   */
  async query(options: AuditQueryOptions) {
    const conditions = [eq(auditLogs.tenantId, options.tenantId)];

    if (options.entityType) {
      conditions.push(eq(auditLogs.entityType, options.entityType));
    }

    if (options.entityId) {
      conditions.push(eq(auditLogs.entityId, options.entityId));
    }

    if (options.userId) {
      conditions.push(eq(auditLogs.userId, options.userId));
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const rows = await this.db.query.auditLogs.findMany({
      where: and(...conditions),
      orderBy: desc(auditLogs.createdAt),
      limit,
      offset,
    });

    return rows.map((row) => ({
      ...row,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    }));
  }
}
