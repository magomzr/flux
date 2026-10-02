import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import type { UsageForecast } from "../models/api.models";

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

  getCurrentUsage(tenantId: string) {
    return this.http.get<UsageForecast>(`${this.base}/tenants/${tenantId}/billing/usage`);
  }
}
