import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditService } from '../../core/api/audit.service';
import { AuthService } from '../../core/auth/auth.service';
import type { AuditLog as AuditLogEntry } from '../../core/models/api.models';

const ENTITY_TYPES = ['flag', 'flag_value', 'project', 'environment', 'tenant', 'sdk_api_key'];

// Inline styles for action badges — uses CSS variables where possible
const ACTION_STYLES: Record<string, string> = {
  created:     'color: var(--success-fg); background-color: var(--success-subtle)',
  updated:     'color: #60a5fa; background-color: rgba(37,99,235,0.15)',
  deleted:     'color: var(--danger-fg); background-color: var(--danger-subtle)',
  published:   'color: var(--accent-text); background-color: var(--accent-subtle)',
  deactivated: 'color: var(--warning-fg); background-color: var(--warning-subtle)',
  revoked:     'color: var(--warning-fg); background-color: var(--warning-subtle)',
  login:       'color: var(--text-secondary); background-color: var(--bg-elevated)',
  logout:      'color: var(--text-secondary); background-color: var(--bg-elevated)',
};

function actionStyle(action: string): string {
  const verb = action.split('.')[1] ?? action;
  return ACTION_STYLES[verb] ?? 'color: var(--text-secondary); background-color: var(--bg-elevated)';
}

const PAGE_SIZE = 25;

@Component({
  selector: 'app-audit-log',
  imports: [DatePipe],
  template: `
    <div class="p-6 max-w-5xl mx-auto">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color: var(--text-primary)">Audit log</h1>
          <p class="text-sm mt-0.5" style="color: var(--text-muted)">All actions performed in this tenant.</p>
        </div>
        <button (click)="refresh()"
          class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          style="color: var(--text-secondary)">
          ↻ Refresh
        </button>
      </div>

      <!-- Filtros -->
      <div class="flex items-center gap-3 mb-5 flex-wrap">
        <select
          [value]="filterEntity()"
          (change)="setEntityFilter($any($event.target).value)"
          class="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 cursor-pointer"
          style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
        >
          <option value="">All entities</option>
          @for (type of entityTypes; track type) {
            <option [value]="type">{{ type }}</option>
          }
        </select>

        @if (filterEntity() || offset() > 0) {
          <button (click)="clearFilters()"
            class="text-xs transition-colors cursor-pointer"
            style="color: var(--text-muted)">
            Clear filters
          </button>
        }

        <span class="text-xs ml-auto" style="color: var(--text-muted)">
          {{ logs().length }} entries
        </span>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="space-y-2">
          @for (_ of [1,2,3,4,5]; track $index) {
            <div class="h-14 rounded-xl animate-pulse skeleton"></div>
          }
        </div>
      }

      <!-- Empty -->
      @if (!loading() && logs().length === 0) {
        <div class="text-center py-16 border border-dashed rounded-xl" style="border-color: var(--border)">
          <p class="text-sm" style="color: var(--text-muted)">No audit entries found.</p>
        </div>
      }

      <!-- Tabla -->
      @if (!loading() && logs().length > 0) {
        <div class="border rounded-xl overflow-hidden" style="border-color: var(--border)">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b" style="border-color: var(--border)">
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Action</th>
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Entity</th>
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium hidden md:table-cell" style="color: var(--text-muted)">Details</th>
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">When</th>
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium hidden lg:table-cell" style="color: var(--text-muted)">IP</th>
              </tr>
            </thead>
            <tbody>
              @for (log of logs(); track log.id) {
                <tr class="border-b last:border-0 transition-colors" style="border-color: var(--table-border)">

                  <!-- Action badge -->
                  <td class="px-4 py-3">
                    <span class="inline-block text-xs font-mono px-2 py-0.5 rounded"
                          [style]="actionStyle(log.action)">
                      {{ log.action }}
                    </span>
                  </td>

                  <!-- Entity -->
                  <td class="px-4 py-3">
                    <p class="text-xs font-mono" style="color: var(--text-secondary)">{{ log.entityType }}</p>
                    <p class="text-xs font-mono mt-0.5" style="color: var(--text-muted)">{{ log.entityId.slice(0, 8) }}…</p>
                  </td>

                  <!-- Metadata preview -->
                  <td class="px-4 py-3 hidden md:table-cell max-w-xs">
                    @if (log.metadata) {
                      <p class="text-xs truncate font-mono" style="color: var(--text-muted)">
                        {{ metadataPreview(log.metadata) }}
                      </p>
                    }
                  </td>

                  <!-- Timestamp -->
                  <td class="px-4 py-3 whitespace-nowrap">
                    <p class="text-xs" style="color: var(--text-secondary)">{{ log.createdAt | date:'MMM d, y' }}</p>
                    <p class="text-xs" style="color: var(--text-muted)">{{ log.createdAt | date:'HH:mm:ss' }}</p>
                  </td>

                  <!-- IP -->
                  <td class="px-4 py-3 hidden lg:table-cell">
                    <p class="text-xs font-mono" style="color: var(--text-muted)">{{ log.ip ?? '—' }}</p>
                  </td>

                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="flex items-center justify-between mt-4">
          <button
            (click)="prevPage()"
            [disabled]="offset() === 0"
            class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            style="color: var(--text-secondary)">
            ← Previous
          </button>

          <span class="text-xs" style="color: var(--text-muted)">
            Showing {{ offset() + 1 }}–{{ offset() + logs().length }}
          </span>

          <button
            (click)="nextPage()"
            [disabled]="logs().length < pageSize"
            class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            style="color: var(--text-secondary)">
            Next →
          </button>
        </div>
      }

    </div>
  `,
})
export class AuditLog implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly auth         = inject(AuthService);

  readonly logs = signal<AuditLogEntry[]>([]);
  readonly loading       = signal(true);
  readonly filterEntity  = signal('');
  readonly offset        = signal(0);

  readonly entityTypes = ENTITY_TYPES;
  readonly pageSize    = PAGE_SIZE;

  ngOnInit() {
    this.load();
  }

  private load() {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.loading.set(true);

    this.auditService.query(tenantId, {
      entityType: this.filterEntity() || undefined,
      limit:  PAGE_SIZE,
      offset: this.offset(),
    }).subscribe({
      next: (data) => {
        this.logs.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  refresh() {
    this.load();
  }

  setEntityFilter(value: string) {
    this.filterEntity.set(value);
    this.offset.set(0);
    this.load();
  }

  clearFilters() {
    this.filterEntity.set('');
    this.offset.set(0);
    this.load();
  }

  nextPage() {
    this.offset.update((o) => o + PAGE_SIZE);
    this.load();
  }

  prevPage() {
    this.offset.update((o) => Math.max(0, o - PAGE_SIZE));
    this.load();
  }

  actionStyle(action: string): string {
    return actionStyle(action);
  }

  metadataPreview(metadata: Record<string, unknown>): string {
    try {
      const str = JSON.stringify(metadata);
      return str.length > 80 ? str.slice(0, 80) + '…' : str;
    } catch {
      return '';
    }
  }
}
