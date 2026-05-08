import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Plan, Subscription, UsageForecast } from '../models/api.models';

export interface CostEstimate {
  planId: string;
  planName: string;
  baseCostUsd: number;
  overageCostUsd: number;
  totalCostUsd: number;
  hasSse: boolean;
  pollIntervalSeconds: number;
  breakdown: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getPlans() {
    return this.http.get<Plan[]>(`${this.base}/plans`);
  }

  getCurrentUsage(tenantId: string) {
    return this.http.get<UsageForecast>(`${this.base}/tenants/${tenantId}/billing/usage`);
  }

  getSubscriptionHistory(tenantId: string) {
    return this.http.get<Subscription[]>(
      `${this.base}/tenants/${tenantId}/billing/subscriptions`,
    );
  }

  subscribe(tenantId: string, planId: string) {
    return this.http.post<Subscription>(
      `${this.base}/tenants/${tenantId}/billing/subscribe`,
      { planId },
    );
  }

  calculateCost(params: {
    evaluationsMonth?: number;
    assetStorageMb?: number;
  }) {
    const query = new URLSearchParams();
    if (params.evaluationsMonth != null)
      query.set('evaluationsMonth', String(params.evaluationsMonth));
    if (params.assetStorageMb != null)
      query.set('assetStorageMb', String(params.assetStorageMb));

    return this.http.get<CostEstimate[]>(
      `${this.base}/billing/estimate?${query.toString()}`,
    );
  }
}
