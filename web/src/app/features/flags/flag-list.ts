import { Component, inject, signal, computed, OnInit, input } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { FlagsService } from "../../core/api/flags.service";
import { EnvironmentsService } from "../../core/api/environments.service";
import { AuthService } from "../../core/auth/auth.service";
import type { Flag, FlagValue, Environment } from "../../core/models/api.models";

interface FlagRow {
  flag: Flag;
  values: Record<string, FlagValue>;
}

/** Which cell is being edited: flagId + environmentId */
interface EditingCell {
  flagId: string;
  environmentId: string;
  currentValue: string;
}

@Component({
  selector: "app-flag-list",
  imports: [ReactiveFormsModule],
  templateUrl: "flag-list.html",
})
export class FlagList implements OnInit {
  readonly projectId = input.required<string>();

  private readonly flagsService = inject(FlagsService);
  private readonly environmentsService = inject(EnvironmentsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly environments = signal<Environment[]>([]);
  readonly rows = signal<FlagRow[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingFlag = signal<Flag | null>(null);
  readonly editingCell = signal<EditingCell | null>(null);

  readonly canPublish = computed(() => this.auth.hasPermission("publish:flag"));

  readonly form = this.fb.nonNullable.group({
    key: ["", [Validators.required, Validators.pattern(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)]],
    name: ["", Validators.required],
    type: ["boolean"],
    description: [""],
  });

  ngOnInit() {
    this.load();
  }

  // ─── Load ─────────────────────────────────────────────────────────────────

  private load() {
    const projectId = this.projectId();
    this.loading.set(true);

    this.environmentsService.findAll(projectId).subscribe({
      next: (envs) => {
        this.environments.set(envs);
        this.loadFlags();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadFlags() {
    const projectId = this.projectId();

    this.flagsService.findAll(projectId).subscribe({
      next: (flags) => {
        const rows: FlagRow[] = flags.map((flag) => {
          const values: Record<string, FlagValue> = {};
          for (const fv of flag.flagValues ?? []) {
            values[fv.environmentId] = fv;
          }
          return { flag, values };
        });
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ─── Toggle enabled ───────────────────────────────────────────────────────

  toggleFlag(row: FlagRow, environmentId: string, fv: FlagValue) {
    const projectId = this.projectId();
    const newEnabled = !fv.enabled;

    this.rows.update((rows) =>
      rows.map((r) =>
        r.flag.id !== row.flag.id
          ? r
          : {
              ...r,
              values: {
                ...r.values,
                [environmentId]: { ...fv, enabled: newEnabled },
              },
            },
      ),
    );

    this.flagsService
      .updateFlagValue(projectId, row.flag.id, environmentId, {
        enabled: newEnabled,
      })
      .subscribe({
        next: (updated) => {
          this.rows.update((rows) =>
            rows.map((r) =>
              r.flag.id !== row.flag.id
                ? r
                : {
                    ...r,
                    values: { ...r.values, [environmentId]: updated },
                  },
            ),
          );
        },
        error: () => {
          // Revertir
          this.rows.update((rows) =>
            rows.map((r) =>
              r.flag.id !== row.flag.id
                ? r
                : {
                    ...r,
                    values: { ...r.values, [environmentId]: fv },
                  },
            ),
          );
        },
      });
  }

  // ─── Inline value editing ─────────────────────────────────────────────────

  isEditing(flagId: string, environmentId: string): boolean {
    const c = this.editingCell();
    return c?.flagId === flagId && c?.environmentId === environmentId;
  }

  startEdit(flagId: string, environmentId: string, currentValue: string) {
    this.editingCell.set({ flagId, environmentId, currentValue });
  }

  updateEditValue(value: string) {
    const c = this.editingCell();
    if (c) this.editingCell.set({ ...c, currentValue: value });
  }

  saveValue(row: FlagRow, environmentId: string, fv: FlagValue) {
    const cell = this.editingCell();
    if (!cell) return;

    const newValue = cell.currentValue;
    this.cancelEdit();

    // Optimistic update
    this.rows.update((rows) =>
      rows.map((r) =>
        r.flag.id !== row.flag.id
          ? r
          : {
              ...r,
              values: {
                ...r.values,
                [environmentId]: { ...fv, value: newValue },
              },
            },
      ),
    );

    this.flagsService
      .updateFlagValue(this.projectId(), row.flag.id, environmentId, {
        value: newValue,
      })
      .subscribe({
        next: (updated) => {
          this.rows.update((rows) =>
            rows.map((r) =>
              r.flag.id !== row.flag.id
                ? r
                : {
                    ...r,
                    values: { ...r.values, [environmentId]: updated },
                  },
            ),
          );
        },
        error: () => {
          // Revertir
          this.rows.update((rows) =>
            rows.map((r) =>
              r.flag.id !== row.flag.id
                ? r
                : {
                    ...r,
                    values: { ...r.values, [environmentId]: fv },
                  },
            ),
          );
        },
      });
  }

  cancelEdit() {
    this.editingCell.set(null);
  }

  // ─── Publish ──────────────────────────────────────────────────────────────

  hasDraft(row: FlagRow): boolean {
    return Object.values(row.values).some((fv) => !fv.publishedAt);
  }

  publishAllDrafts(row: FlagRow) {
    const projectId = this.projectId();
    const drafts = Object.entries(row.values).filter(([, fv]) => !fv.publishedAt);

    for (const [environmentId, fv] of drafts) {
      this.flagsService.publishFlagValue(projectId, row.flag.id, environmentId).subscribe({
        next: (updated) => {
          this.rows.update((rows) =>
            rows.map((r) =>
              r.flag.id !== row.flag.id
                ? r
                : {
                    ...r,
                    values: { ...r.values, [environmentId]: updated },
                  },
            ),
          );
        },
      });
    }
  }

  publishFlag(row: FlagRow, environmentId: string, fv: FlagValue) {
    this.flagsService.publishFlagValue(this.projectId(), row.flag.id, environmentId).subscribe({
      next: (updated) => {
        this.rows.update((rows) =>
          rows.map((r) =>
            r.flag.id !== row.flag.id
              ? r
              : {
                  ...r,
                  values: { ...r.values, [environmentId]: updated },
                },
          ),
        );
      },
    });
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  create() {
    if (this.form.invalid || this.saving()) return;

    const projectId = this.projectId();
    this.saving.set(true);
    this.formError.set(null);

    const { key, name, type, description } = this.form.getRawValue();

    this.flagsService
      .create(projectId, {
        key,
        name,
        type: type as any,
        description: description || undefined,
      })
      .subscribe({
        next: () => {
          this.loadFlags();
          this.cancelForm();
          this.saving.set(false);
        },
        error: (err) => {
          this.formError.set(
            err.status === 409 ? "Esta flag ya existe en este proyecto." : "Algo salió mal.",
          );
          this.saving.set(false);
        },
      });
  }

  confirmDelete(flag: Flag) {
    this.deletingFlag.set(flag);
  }

  deleteFlag() {
    const flag = this.deletingFlag();
    if (!flag) return;

    this.flagsService.remove(this.projectId(), flag.id).subscribe({
      next: () => {
        this.rows.update((rows) => rows.filter((r) => r.flag.id !== flag.id));
        this.deletingFlag.set(null);
      },
    });
  }

  cancelForm() {
    this.showForm.set(false);
    this.form.reset({ type: "boolean" });
    this.formError.set(null);
  }
}
