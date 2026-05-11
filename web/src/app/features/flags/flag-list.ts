import { Component, inject, signal, computed, OnInit, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FlagsService } from '../../core/api/flags.service';
import { EnvironmentsService } from '../../core/api/environments.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Flag, FlagValue, Environment } from '../../core/models/api.models';

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
  selector: 'app-flag-list',
  imports: [ReactiveFormsModule],
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-base font-semibold" style="color: var(--text-primary)">Flags</h2>
          <p class="text-sm mt-0.5" style="color: var(--text-muted)">{{ rows().length }} flags</p>
        </div>
        <button
          (click)="showForm.set(true)"
          class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          style="background-color: var(--accent); color: var(--accent-fg)"
        >
          + New flag
        </button>
      </div>

      <!-- Create form -->
      @if (showForm()) {
        <div class="border rounded-xl p-5 mb-6" style="background-color: var(--bg-surface); border-color: var(--border)">
          <h3 class="text-sm font-medium mb-4" style="color: var(--text-primary)">New flag</h3>
          <form [formGroup]="form" (ngSubmit)="create()" class="grid grid-cols-2 gap-4">

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Key</label>
              <input formControlName="key" placeholder="new_checkout_flow"
                class="w-full rounded-lg px-3 py-2 text-sm font-mono border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
              <p class="text-xs" style="color: var(--text-muted)">lowercase, underscores only</p>
            </div>

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Name</label>
              <input formControlName="name" placeholder="New Checkout Flow"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
            </div>

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Type</label>
              <select formControlName="type"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)">
                <option value="boolean">boolean</option>
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="json">json</option>
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">
                Description <span class="normal-case" style="color: var(--text-muted)">(optional)</span>
              </label>
              <input formControlName="description" placeholder="What does this flag control?"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
            </div>

            @if (formError()) {
              <p class="col-span-2 text-xs rounded-lg px-3 py-2"
                 style="color: var(--danger-fg); background-color: var(--danger-subtle); border: 1px solid var(--danger-fg)">
                {{ formError() }}
              </p>
            }

            <div class="col-span-2 flex justify-end gap-2">
              <button type="button" (click)="cancelForm()"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)">
                Cancel
              </button>
              <button type="submit" [disabled]="form.invalid || saving()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style="background-color: var(--accent); color: var(--accent-fg)">
                {{ saving() ? 'Creating...' : 'Create flag' }}
              </button>
            </div>

          </form>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="space-y-2">
          @for (_ of [1,2,3,4]; track $index) {
            <div class="h-14 rounded-xl animate-pulse skeleton"></div>
          }
        </div>
      }

      <!-- Sin ambientes -->
      @if (!loading() && environments().length === 0) {
        <div class="text-center py-12 border border-dashed rounded-xl" style="border-color: var(--border)">
          <p class="text-sm" style="color: var(--text-muted)">No environments yet.</p>
          <p class="text-xs mt-1" style="color: var(--text-muted)">
            Go to the <strong>Environments</strong> tab to create at least one.
          </p>
        </div>
      }

      <!-- Empty -->
      @if (!loading() && environments().length > 0 && rows().length === 0) {
        <div class="text-center py-12 border border-dashed rounded-xl" style="border-color: var(--border)">
          <p class="text-sm" style="color: var(--text-muted)">No flags yet.</p>
          <p class="text-xs mt-1" style="color: var(--text-muted)">Create your first flag to get started.</p>
        </div>
      }

      <!-- Tabla de flags -->
      @if (!loading() && environments().length > 0 && rows().length > 0) {
        <div class="border rounded-xl overflow-x-auto" style="border-color: var(--border)">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b" style="border-color: var(--border)">
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium"
                    style="color: var(--text-muted); min-width: 200px">Flag</th>
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium"
                    style="color: var(--text-muted)">Type</th>
                @for (env of environments(); track env.id) {
                  <th class="text-center text-xs uppercase tracking-wider px-4 py-3 font-medium"
                      style="color: var(--text-muted); min-width: 140px">
                    <span class="inline-flex items-center gap-1.5">
                      @if (env.color) {
                        <span class="w-2 h-2 rounded-full flex-shrink-0"
                              [style.background-color]="env.color"></span>
                      }
                      {{ env.name }}
                    </span>
                  </th>
                }
                <th class="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.flag.id) {
                <tr class="border-b last:border-0 transition-colors"
                    style="border-color: var(--table-border)">

                  <!-- Flag info -->
                  <td class="px-4 py-3">
                    <p class="font-medium text-sm" style="color: var(--text-primary)">{{ row.flag.name }}</p>
                    <p class="font-mono text-xs mt-0.5" style="color: var(--text-muted)">{{ row.flag.key }}</p>
                  </td>

                  <!-- Type badge -->
                  <td class="px-4 py-3">
                    <span class="text-xs px-2 py-0.5 rounded font-mono"
                          style="color: var(--text-secondary); background-color: var(--bg-elevated)">
                      {{ row.flag.type }}
                    </span>
                  </td>

                  <!-- Valor por ambiente -->
                  @for (env of environments(); track env.id) {
                    <td class="px-4 py-3 text-center">
                      @if (row.values[env.id]; as fv) {

                        <!-- Boolean: toggle switch -->
                        @if (row.flag.type === 'boolean') {
                          <div class="flex flex-col items-center gap-1">
                            <button
                              (click)="toggleFlag(row, env.id, fv)"
                              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer"
                              [style.background-color]="fv.enabled ? 'var(--accent)' : 'var(--bg-elevated)'"
                              [title]="fv.enabled ? 'Disable in ' + env.name : 'Enable in ' + env.name"
                            >
                              <span
                                class="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                                [class]="fv.enabled ? 'translate-x-4' : 'translate-x-1'"
                                style="background-color: #fff"
                              ></span>
                            </button>
                            @if (fv.publishedAt) {
                              <p class="text-xs" style="color: var(--text-muted)">published</p>
                            } @else {
                              <p class="text-xs" style="color: var(--warning-fg)">draft</p>
                            }
                          </div>
                        }

                        <!-- String / Number / JSON: editable value -->
                        @if (row.flag.type !== 'boolean') {
                          <div class="flex flex-col items-center gap-1">

                            <!-- Toggle enabled -->
                            <button
                              (click)="toggleFlag(row, env.id, fv)"
                              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer"
                              [style.background-color]="fv.enabled ? 'var(--accent)' : 'var(--bg-elevated)'"
                              [title]="fv.enabled ? 'Disable' : 'Enable'"
                            >
                              <span
                                class="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                                [class]="fv.enabled ? 'translate-x-4' : 'translate-x-1'"
                                style="background-color: #fff"
                              ></span>
                            </button>

                            <!-- Inline value editor -->
                            @if (isEditing(row.flag.id, env.id)) {
                              <div class="flex items-center gap-1 mt-1">
                                <input
                                  [value]="editingCell()!.currentValue"
                                  (input)="updateEditValue($any($event.target).value)"
                                  (keydown.enter)="saveValue(row, env.id, fv)"
                                  (keydown.escape)="cancelEdit()"
                                  class="w-24 rounded px-1.5 py-0.5 text-xs font-mono border focus:outline-none"
                                  style="background-color: var(--input-bg); border-color: var(--input-focus); color: var(--text-primary)"
                                  autofocus
                                />
                                <button (click)="saveValue(row, env.id, fv)"
                                  class="text-xs cursor-pointer" style="color: var(--success-fg)">✓</button>
                                <button (click)="cancelEdit()"
                                  class="text-xs cursor-pointer" style="color: var(--text-muted)">✕</button>
                              </div>
                            } @else {
                              <button
                                (click)="startEdit(row.flag.id, env.id, fv.value ?? '')"
                                class="text-xs font-mono px-1.5 py-0.5 rounded transition-colors cursor-pointer max-w-28 truncate"
                                style="color: var(--text-secondary); background-color: var(--bg-elevated)"
                                [title]="fv.value ?? 'click to set value'"
                              >
                                {{ fv.value ? (fv.value.length > 12 ? fv.value.slice(0, 12) + '…' : fv.value) : '—' }}
                              </button>
                            }

                            @if (fv.publishedAt) {
                              <p class="text-xs" style="color: var(--text-muted)">published</p>
                            } @else {
                              <button (click)="publishFlag(row, env.id, fv)"
                                class="text-xs cursor-pointer transition-colors"
                                style="color: var(--warning-fg)"
                                title="Publish to make it live">
                                draft · publish
                              </button>
                            }
                          </div>
                        }

                      } @else {
                        <span class="text-xs" style="color: var(--text-muted)">—</span>
                      }
                    </td>
                  }

                  <!-- Acciones -->
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-3">
                      <!-- Publish: aparece si algún ambiente tiene draft -->
                      @if (hasDraft(row)) {
                        <button (click)="publishAllDrafts(row)"
                          class="text-xs transition-colors cursor-pointer"
                          style="color: var(--warning-fg)"
                          title="Publish all draft environments">
                          Publish
                        </button>
                      }
                      <button (click)="confirmDelete(row.flag)"
                        class="transition-colors cursor-pointer text-xs"
                        style="color: var(--text-muted)">
                        Delete
                      </button>
                    </div>
                  </td>

                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Delete confirm -->
      @if (deletingFlag()) {
        <div class="fixed inset-0 flex items-center justify-center z-50 px-4"
             style="background-color: var(--bg-overlay)">
          <div class="border rounded-xl p-6 max-w-sm w-full"
               style="background-color: var(--bg-surface); border-color: var(--border)">
            <h3 class="text-sm font-medium mb-2" style="color: var(--text-primary)">Delete flag</h3>
            <p class="text-sm mb-5" style="color: var(--text-secondary)">
              This will permanently delete
              <span class="font-mono text-xs" style="color: var(--text-primary)">{{ deletingFlag()!.key }}</span>
              across all environments.
            </p>
            <div class="flex justify-end gap-2">
              <button (click)="deletingFlag.set(null)"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)">
                Cancel
              </button>
              <button (click)="deleteFlag()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="background-color: var(--danger); color: #fff">
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class FlagList implements OnInit {
  readonly projectId = input.required<string>();

  private readonly flagsService        = inject(FlagsService);
  private readonly environmentsService = inject(EnvironmentsService);
  private readonly auth                = inject(AuthService);
  private readonly fb                  = inject(FormBuilder);

  readonly environments = signal<Environment[]>([]);
  readonly rows         = signal<FlagRow[]>([]);
  readonly loading      = signal(true);
  readonly saving       = signal(false);
  readonly showForm     = signal(false);
  readonly formError    = signal<string | null>(null);
  readonly deletingFlag = signal<Flag | null>(null);
  readonly editingCell  = signal<EditingCell | null>(null);

  readonly canPublish = computed(() => this.auth.hasPermission('publish:flag'));

  readonly form = this.fb.nonNullable.group({
    key:         ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)]],
    name:        ['', Validators.required],
    type:        ['boolean'],
    description: [''],
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
    const projectId  = this.projectId();
    const newEnabled = !fv.enabled;

    this.rows.update((rows) =>
      rows.map((r) => r.flag.id !== row.flag.id ? r : {
        ...r,
        values: { ...r.values, [environmentId]: { ...fv, enabled: newEnabled } },
      }),
    );

    this.flagsService
      .updateFlagValue(projectId, row.flag.id, environmentId, { enabled: newEnabled })
      .subscribe({
        next: (updated) => {
          this.rows.update((rows) =>
            rows.map((r) => r.flag.id !== row.flag.id ? r : {
              ...r,
              values: { ...r.values, [environmentId]: updated },
            }),
          );
        },
        error: () => {
          // Revertir
          this.rows.update((rows) =>
            rows.map((r) => r.flag.id !== row.flag.id ? r : {
              ...r,
              values: { ...r.values, [environmentId]: fv },
            }),
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
      rows.map((r) => r.flag.id !== row.flag.id ? r : {
        ...r,
        values: { ...r.values, [environmentId]: { ...fv, value: newValue } },
      }),
    );

    this.flagsService
      .updateFlagValue(this.projectId(), row.flag.id, environmentId, { value: newValue })
      .subscribe({
        next: (updated) => {
          this.rows.update((rows) =>
            rows.map((r) => r.flag.id !== row.flag.id ? r : {
              ...r,
              values: { ...r.values, [environmentId]: updated },
            }),
          );
        },
        error: () => {
          // Revertir
          this.rows.update((rows) =>
            rows.map((r) => r.flag.id !== row.flag.id ? r : {
              ...r,
              values: { ...r.values, [environmentId]: fv },
            }),
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
      this.flagsService
        .publishFlagValue(projectId, row.flag.id, environmentId)
        .subscribe({
          next: (updated) => {
            this.rows.update((rows) =>
              rows.map((r) => r.flag.id !== row.flag.id ? r : {
                ...r,
                values: { ...r.values, [environmentId]: updated },
              }),
            );
          },
        });
    }
  }

  publishFlag(row: FlagRow, environmentId: string, fv: FlagValue) {
    this.flagsService
      .publishFlagValue(this.projectId(), row.flag.id, environmentId)
      .subscribe({
        next: (updated) => {
          this.rows.update((rows) =>
            rows.map((r) => r.flag.id !== row.flag.id ? r : {
              ...r,
              values: { ...r.values, [environmentId]: updated },
            }),
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

    this.flagsService.create(projectId, {
      key, name, type: type as any,
      description: description || undefined,
    }).subscribe({
      next: () => {
        this.loadFlags();
        this.cancelForm();
        this.saving.set(false);
      },
      error: (err) => {
        this.formError.set(
          err.status === 409 ? 'Key already exists in this project.' : 'Something went wrong.',
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
    this.form.reset({ type: 'boolean' });
    this.formError.set(null);
  }
}
