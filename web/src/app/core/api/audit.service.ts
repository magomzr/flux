import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { AuditLog } from '../models/api.models';

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  query(tenantId: string, params: AuditQuery = {}) {
    const query = new URLSearchParams();
    if (params.entityType) query.set('entityType', params.entityType);
    if (params.entityId)   query.set('entityId', params.entityId);
    if (params.userId)     query.set('userId', params.userId);
    if (params.limit)      query.set('limit', String(params.limit));
    if (params.offset)     query.set('offset', String(params.offset));

    const qs = query.toString();
    return this.http.get<AuditLog[]>(
      `${this.base}/tenants/${tenantId}/audit${qs ? '?' + qs : ''}`,
    );
  }
}
