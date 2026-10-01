import { Component, inject, signal, OnInit } from "@angular/core";
import { DatePipe } from "@angular/common";
import { AuditService } from "../../core/api/audit.service";
import { AuthService } from "../../core/auth/auth.service";
import type { AuditLog as AuditLogEntry } from "../../core/models/api.models";

const ENTITY_TYPES = ["flag", "flag_value", "project", "environment", "tenant", "sdk_api_key"];

// Inline styles for action badges — uses CSS variables where possible
const ACTION_STYLES: Record<string, string> = {
  created: "color: var(--success-fg); background-color: var(--success-subtle)",
  updated: "color: #60a5fa; background-color: rgba(37,99,235,0.15)",
  deleted: "color: var(--danger-fg); background-color: var(--danger-subtle)",
  published: "color: var(--accent-text); background-color: var(--accent-subtle)",
  deactivated: "color: var(--warning-fg); background-color: var(--warning-subtle)",
  revoked: "color: var(--warning-fg); background-color: var(--warning-subtle)",
  login: "color: var(--text-secondary); background-color: var(--bg-elevated)",
  logout: "color: var(--text-secondary); background-color: var(--bg-elevated)",
};

function actionStyle(action: string): string {
  const verb = action.split(".")[1] ?? action;
  return (
    ACTION_STYLES[verb] ?? "color: var(--text-secondary); background-color: var(--bg-elevated)"
  );
}

const PAGE_SIZE = 25;

@Component({
  selector: "app-audit-log",
  imports: [DatePipe],
  templateUrl: "audit-log.html",
})
export class AuditLog implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly auth = inject(AuthService);

  readonly logs = signal<AuditLogEntry[]>([]);
  readonly loading = signal(true);
  readonly filterEntity = signal("");
  readonly offset = signal(0);
  readonly detailLog = signal<AuditLogEntry | null>(null);

  readonly entityTypes = ENTITY_TYPES;
  readonly pageSize = PAGE_SIZE;

  ngOnInit() {
    this.load();
  }

  private load() {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.loading.set(true);

    this.auditService
      .query(tenantId, {
        entityType: this.filterEntity() || undefined,
        limit: PAGE_SIZE,
        offset: this.offset(),
      })
      .subscribe({
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
    this.filterEntity.set("");
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

  openDetail(log: AuditLogEntry) {
    this.detailLog.set(log);
  }

  actionStyle(action: string): string {
    return actionStyle(action);
  }

  metadataPreview(metadata: Record<string, unknown>): string {
    try {
      const str = JSON.stringify(metadata);
      return str.length > 80 ? str.slice(0, 80) + "…" : str;
    } catch {
      return "";
    }
  }

  formatMetadata(metadata: Record<string, unknown>): string {
    try {
      return JSON.stringify(metadata, null, 2);
    } catch {
      return String(metadata);
    }
  }
}
