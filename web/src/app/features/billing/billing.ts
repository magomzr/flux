import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { BillingService, CostEstimate } from '../../core/api/billing.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Subscription, UsageForecast } from '../../core/models/api.models';

@Component({
  selector: 'app-billing',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, CurrencyPipe],
  template: `
    <div class="p-6 max-w-4xl mx-auto space-y-8">

      <div>
        <h1 class="text-lg font-semibold" style="color: var(--text-primary)">Billing</h1>
        <p class="text-sm mt-0.5" style="color: var(--text-muted)">Usage, plan and cost forecast for this month.</p>
      </div>

      <!-- ─── Plan activo + uso ──────────────────────────────────────────────── -->
      @if (usage()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

          <!-- Plan -->
          <div class="border rounded-xl p-4" style="background-color: var(--bg-surface); border-color: var(--border)">
            <p class="text-xs uppercase tracking-wider mb-3" style="color: var(--text-muted)">Current plan</p>
            @if (usage()!.plan) {
              <p class="text-xl font-semibold" style="color: var(--text-primary)">{{ usage()!.plan!.name }}</p>
              <p class="text-sm mt-1" style="color: var(--text-secondary)">
                {{ usage()!.plan!.baseCostUsd | currency:'USD':'symbol':'1.0-0' }}/mo base
              </p>
            } @else {
              <p class="text-sm" style="color: var(--text-muted)">No active plan</p>
            }
          </div>

          <!-- Costo -->
          <div class="border rounded-xl p-4" style="background-color: var(--bg-surface); border-color: var(--border)">
            <p class="text-xs uppercase tracking-wider mb-3" style="color: var(--text-muted)">Cost</p>
            <p class="text-xl font-semibold" style="color: var(--text-primary)">
              {{ currentCost() | currency:'USD':'symbol':'1.2-2' }}
            </p>
            <p class="text-xs mt-0.5" style="color: var(--text-muted)">so far this month</p>
            <div class="mt-3 pt-3 border-t" style="border-color: var(--border)">
              <p class="text-sm font-medium"
                 [style.color]="evalOverage() ? 'var(--warning-fg)' : 'var(--text-secondary)'">
                {{ usage()!.cost.totalCostUsd | currency:'USD':'symbol':'1.2-2' }}
              </p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted)">
                estimated end of month
                @if (evalOverage()) {
                  · <span style="color: var(--warning-fg)">+{{ usage()!.cost.overageCostUsd | currency:'USD':'symbol':'1.2-2' }} overage</span>
                }
              </p>
            </div>
          </div>

          <!-- Período -->
          <div class="border rounded-xl p-4" style="background-color: var(--bg-surface); border-color: var(--border)">
            <p class="text-xs uppercase tracking-wider mb-3" style="color: var(--text-muted)">Period</p>
            <p class="text-xl font-semibold" style="color: var(--text-primary)">{{ usage()!.period.percentElapsed }}%</p>
            <p class="text-xs mt-0.5" style="color: var(--text-muted)">
              Day {{ usage()!.period.dayOfMonth }} of {{ usage()!.period.daysInMonth }}
            </p>
            <div class="mt-3 h-1.5 rounded-full overflow-hidden" style="background-color: var(--bg-elevated)">
              <div class="h-full rounded-full transition-all"
                   style="background-color: var(--accent)"
                   [style.width.%]="usage()!.period.percentElapsed"></div>
            </div>
          </div>

        </div>

        <!-- Uso detallado -->
        <div class="border rounded-xl p-5" style="background-color: var(--bg-surface); border-color: var(--border)">
          <h2 class="text-sm font-medium mb-4" style="color: var(--text-primary)">Usage breakdown</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

            <!-- Evaluaciones -->
            <div>
              <p class="text-xs mb-2" style="color: var(--text-muted)">Evaluations</p>
              <p class="text-lg font-semibold" style="color: var(--text-primary)">
                {{ usage()!.actual.evaluationsCount | number }}
              </p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted)">so far this month</p>
              <div class="mt-2 h-1 rounded-full overflow-hidden" style="background-color: var(--bg-elevated)">
                <div class="h-full rounded-full transition-all"
                     [style.background-color]="evalOverage() ? 'var(--warning-fg)' : 'var(--accent)'"
                     [style.width.%]="evalPct()"></div>
              </div>
              <div class="mt-2 pt-2 border-t" style="border-color: var(--border-subtle)">
                <p class="text-sm font-medium"
                   [style.color]="evalOverage() ? 'var(--warning-fg)' : 'var(--text-secondary)'">
                  {{ usage()!.projected.evaluationsCount | number }}
                </p>
                <p class="text-xs mt-0.5" style="color: var(--text-muted)">
                  projected end of month
                  @if (evalOverage()) {
                    · <span style="color: var(--warning-fg)">
                      +{{ evalOverageCount() | number }} over limit
                    </span>
                  }
                </p>
              </div>
            </div>

            <!-- Storage -->
            <div>
              <p class="text-xs mb-2" style="color: var(--text-muted)">Asset storage</p>
              <p class="text-lg font-semibold" style="color: var(--text-primary)">
                {{ usage()!.actual.assetStorageMb | number }} MB
              </p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted)">so far this month</p>
              <div class="mt-2 pt-2 border-t" style="border-color: var(--border-subtle)">
                <p class="text-sm font-medium" style="color: var(--text-secondary)">
                  {{ usage()!.projected.assetStorageMb | number }} MB
                </p>
                <p class="text-xs mt-0.5" style="color: var(--text-muted)">projected end of month</p>
              </div>
            </div>

            <!-- SSE -->
            <div>
              <p class="text-xs mb-2" style="color: var(--text-muted)">SSE connections (peak)</p>
              <p class="text-lg font-semibold" style="color: var(--text-primary)">
                {{ usage()!.actual.sseConnectionsMax | number }}
              </p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted)">max concurrent this month</p>
            </div>

          </div>
        </div>
      }

      @if (loadingUsage()) {
        <div class="grid grid-cols-3 gap-4">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-24 rounded-xl animate-pulse skeleton"></div>
          }
        </div>
      }

      <!-- ─── Calculadora ───────────────────────────────────────────────────── -->
      <div class="border rounded-xl p-5" style="background-color: var(--bg-surface); border-color: var(--border)">
        <h2 class="text-sm font-medium mb-1" style="color: var(--text-primary)">Cost calculator</h2>
        <p class="text-xs mb-4" style="color: var(--text-muted)">Estimate your monthly cost across all plans.</p>

        <form [formGroup]="calcForm" (ngSubmit)="calculate()" class="flex items-end gap-4 mb-5">
          <div class="space-y-1">
            <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Evaluations/month</label>
            <input formControlName="evaluationsMonth" type="number" placeholder="500000"
              class="w-40 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
              style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
          </div>
          <div class="space-y-1">
            <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Storage (MB)</label>
            <input formControlName="assetStorageMb" type="number" placeholder="0"
              class="w-32 rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
              style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
          </div>
          <button type="submit" [disabled]="calculating()"
            class="text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style="background-color: var(--accent); color: var(--accent-fg)">
            {{ calculating() ? 'Calculating...' : 'Calculate' }}
          </button>
        </form>

        @if (estimates().length > 0) {
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            @for (est of estimates(); track est.planId) {
              <div class="border rounded-xl p-4 transition-colors"
                   [style.border-color]="est.planId === usage()?.plan?.id ? 'var(--accent)' : 'var(--border)'"
                   [style.background-color]="est.planId === usage()?.plan?.id ? 'var(--accent-subtle)' : 'var(--bg-app)'">
                <div class="flex items-center justify-between mb-2">
                  <p class="text-sm font-medium" style="color: var(--text-primary)">{{ est.planName }}</p>
                  @if (est.planId === usage()?.plan?.id) {
                    <span class="text-xs" style="color: var(--accent-text)">current</span>
                  }
                </div>
                <p class="text-2xl font-semibold" style="color: var(--text-primary)">
                  {{ est.totalCostUsd | currency:'USD':'symbol':'1.2-2' }}
                </p>
                <p class="text-xs mt-1" style="color: var(--text-muted)">
                  {{ est.baseCostUsd | currency:'USD':'symbol':'1.0-0' }} base
                  @if (est.overageCostUsd > 0) {
                    + {{ est.overageCostUsd | currency:'USD':'symbol':'1.2-2' }} overage
                  }
                </p>
                @if (!est.hasSse) {
                  <p class="text-xs mt-2" style="color: var(--text-muted)">No SSE</p>
                } @else {
                  <p class="text-xs mt-2" style="color: var(--text-muted)">SSE included</p>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- ─── Historial de suscripciones ───────────────────────────────────── -->
      <div>
        <h2 class="text-sm font-medium mb-3" style="color: var(--text-primary)">Subscription history</h2>

        @if (loadingHistory()) {
          <div class="h-24 rounded-xl animate-pulse skeleton"></div>
        }

        @if (!loadingHistory() && subscriptions().length > 0) {
          <div class="border rounded-xl overflow-hidden" style="border-color: var(--border)">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b" style="border-color: var(--border)">
                  <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Plan</th>
                  <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Started</th>
                  <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Ended</th>
                  <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (sub of subscriptions(); track sub.id) {
                  <tr class="border-b last:border-0" style="border-color: var(--table-border)">
                    <td class="px-4 py-3 font-medium" style="color: var(--text-primary)">{{ sub.planId }}</td>
                    <td class="px-4 py-3" style="color: var(--text-secondary)">{{ sub.startedAt | date:'MMM d, y' }}</td>
                    <td class="px-4 py-3" style="color: var(--text-secondary)">
                      {{ sub.endsAt ? (sub.endsAt | date:'MMM d, y') : '—' }}
                    </td>
                    <td class="px-4 py-3">
                      @if (!sub.endsAt) {
                        <span class="inline-flex items-center gap-1.5 text-xs" style="color: var(--success-fg)">
                          <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--success-fg)"></span>
                          Active
                        </span>
                      } @else {
                        <span class="text-xs" style="color: var(--text-muted)">Ended</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

    </div>
  `,
})
export class Billing implements OnInit {
  private readonly billingService = inject(BillingService);
  private readonly auth           = inject(AuthService);
  private readonly fb             = inject(FormBuilder);

  readonly usage         = signal<UsageForecast | null>(null);
  readonly subscriptions = signal<Subscription[]>([]);
  readonly estimates     = signal<CostEstimate[]>([]);
  readonly loadingUsage   = signal(true);
  readonly loadingHistory = signal(true);
  readonly calculating    = signal(false);

  readonly calcForm = this.fb.nonNullable.group({
    evaluationsMonth: [500000],
    assetStorageMb:   [0],
  });

  // % de evaluaciones usadas vs límite del plan
  readonly evalPct = computed(() => {
    const u = this.usage();
    if (!u) return 0;
    // Si no hay límite (Pro), mostrar basado en proyección vs actual
    return Math.min(100, (u.actual.evaluationsCount / Math.max(u.projected.evaluationsCount, 1)) * 100);
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

    this.billingService.getSubscriptionHistory(tenantId).subscribe({
      next: (data) => {
        this.subscriptions.set(data);
        this.loadingHistory.set(false);
      },
      error: () => this.loadingHistory.set(false),
    });
  }

  calculate() {
    this.calculating.set(true);
    const { evaluationsMonth, assetStorageMb } = this.calcForm.getRawValue();

    this.billingService.calculateCost({ evaluationsMonth, assetStorageMb }).subscribe({
      next: (data) => {
        this.estimates.set(data);
        this.calculating.set(false);
      },
      error: () => this.calculating.set(false),
    });
  }
}
