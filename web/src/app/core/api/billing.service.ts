import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import type { Plan, Subscription, UsageForecast } from "../models/api.models";

export interface CostEstimate {
  planId: string;
  planName: string;
  baseCostUsd: number;
  overageCostUsd: number;
  totalCostUsd: number;
  hasSse: boolean;
  breakdown: Record<string, number>;
}

@Injectable({ providedIn: "root" })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getPlans() {
    return this.http.get<Plan[]>(`${this.base}/plans`);
  }

  getCurrentUsage(tenantId: string) {
    return this.http.get<UsageForecast>(`${this.base}/tenants/${tenantId}/billing/usage`);
  }

  subscribe(tenantId: string, planId: string) {
    return this.http.post<Subscription>(`${this.base}/tenants/${tenantId}/billing/subscribe`, {
      planId,
    });
  }
}
