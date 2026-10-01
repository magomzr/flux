import { Component, inject, signal, computed, OnInit } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { DecimalPipe, CurrencyPipe } from "@angular/common";
import { BillingService, CostEstimate } from "../../core/api/billing.service";
import { AuthService } from "../../core/auth/auth.service";
import type { Subscription, UsageForecast } from "../../core/models/api.models";

@Component({
  selector: "app-billing",
  imports: [ReactiveFormsModule, DecimalPipe, CurrencyPipe],
  templateUrl: "billing.html",
})
export class Billing implements OnInit {
  private readonly billingService = inject(BillingService);
  private readonly auth = inject(AuthService);

  readonly usage = signal<UsageForecast | null>(null);
  readonly subscriptions = signal<Subscription[]>([]);
  readonly estimates = signal<CostEstimate[]>([]);
  readonly loadingUsage = signal(true);
  readonly calculating = signal(false);

  // % de evaluaciones usadas vs límite del plan
  readonly evalPct = computed(() => {
    const u = this.usage();
    if (!u) return 0;
    // Si no hay límite (Pro), mostrar basado en proyección vs actual
    return Math.min(
      100,
      (u.actual.evaluationsCount / Math.max(u.projected.evaluationsCount, 1)) * 100,
    );
  });

  readonly evalOverage = computed(() => (this.usage()?.cost.overageCostUsd ?? 0) > 0);

  /** Costo acumulado hasta hoy (proporcional al % del mes transcurrido) */
  readonly currentCost = computed(() => {
    const u = this.usage();
    if (!u) return 0;
    const fraction = u.period.percentElapsed / 100;
    return Math.round(u.cost.totalCostUsd * fraction * 100) / 100;
  });

  /** Evaluaciones por encima del límite del plan (proyectadas) */
  readonly evalOverageCount = computed(() => {
    const u = this.usage();
    if (!u) return 0;
    return Math.max(0, u.projected.evaluationsCount - u.actual.evaluationsCount);
  });

  ngOnInit() {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.billingService.getCurrentUsage(tenantId).subscribe({
      next: (data) => {
        this.usage.set(data);
        this.loadingUsage.set(false);
      },
      error: () => this.loadingUsage.set(false),
    });
  }
}
