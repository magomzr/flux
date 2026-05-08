import { Component, inject, signal, input, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { EnvironmentsService } from '../../core/api/environments.service';
import type { Environment } from '../../core/models/api.models';

const PRESET_COLORS = [
  { label: 'Production', color: '#ef4444' },
  { label: 'Staging',    color: '#f59e0b' },
  { label: 'Dev',        color: '#22c55e' },
  { label: 'Indigo',     color: '#6366f1' },
  { label: 'Cyan',       color: '#06b6d4' },
];

@Component({
  selector: 'app-environment-list',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-base font-semibold" style="color: var(--text-primary)">Environments</h2>
          <p class="text-sm mt-0.5" style="color: var(--text-muted)">{{ environments().length }} environments</p>
        </div>
        <button
          (click)="showForm.set(true)"
          class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          style="background-color: var(--accent); color: var(--accent-fg)"
        >
          + New environment
        </button>
      </div>

      <!-- Create form -->
      @if (showForm()) {
        <div class="border rounded-xl p-5 mb-6" style="background-color: var(--bg-surface); border-color: var(--border)">
          <h3 class="text-sm font-medium mb-4" style="color: var(--text-primary)">New environment</h3>
          <form [formGroup]="form" (ngSubmit)="create()" class="space-y-4">

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Name</label>
                <input formControlName="name" placeholder="Production"
                  class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                  style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
              </div>
              <div class="space-y-1">
                <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Slug</label>
                <input formControlName="slug" placeholder="production"
                  class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                  style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
              </div>
            </div>

            <!-- Color picker -->
            <div class="space-y-2">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Color</label>
              <div class="flex items-center gap-2">
                @for (preset of presetColors; track preset.color) {
                  <button
                    type="button"
                    (click)="form.patchValue({ color: preset.color })"
                    [title]="preset.label"
                    class="w-6 h-6 rounded-full border-2 transition-all cursor-pointer"
                    [style.background-color]="preset.color"
                    [class.border-white]="form.value.color === preset.color"
                    [class.border-transparent]="form.value.color !== preset.color"
                  ></button>
                }
                <input formControlName="color" placeholder="#6366f1"
                  class="w-28 rounded-lg px-3 py-1.5 text-xs font-mono border focus:outline-none focus:ring-2 focus:border-transparent"
                  style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
              </div>
            </div>

            @if (formError()) {
              <p class="text-xs rounded-lg px-3 py-2" style="color: var(--danger-fg); background-color: var(--danger-subtle); border: 1px solid var(--danger-fg)">
                {{ formError() }}
              </p>
            }

            <div class="flex justify-end gap-2">
              <button type="button" (click)="cancelForm()"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)">
                Cancel
              </button>
              <button type="submit" [disabled]="form.invalid || saving()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style="background-color: var(--accent); color: var(--accent-fg)">
                {{ saving() ? 'Creating...' : 'Create environment' }}
              </button>
            </div>

          </form>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="space-y-3">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-20 rounded-xl animate-pulse skeleton"></div>
          }
        </div>
      }

      <!-- Empty -->
      @if (!loading() && environments().length === 0) {
        <div class="text-center py-12 border border-dashed rounded-xl" style="border-color: var(--border)">
          <p class="text-sm" style="color: var(--text-muted)">No environments yet.</p>
          <p class="text-xs mt-1" style="color: var(--text-muted)">Create at least one to start managing flags.</p>
        </div>
      }

      <!-- Lista -->
      @if (!loading() && environments().length > 0) {
        <div class="space-y-3">
          @for (env of environments(); track env.id) {
            <div class="border rounded-xl px-4 py-3 flex items-center gap-4" style="background-color: var(--bg-surface); border-color: var(--border)">

              <!-- Color dot -->
              <div class="w-3 h-3 rounded-full flex-shrink-0"
                   [style.background-color]="env.color ?? '#52525b'"></div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium" style="color: var(--text-primary)">{{ env.name }}</p>
                  @if (env.isDefault) {
                    <span class="text-xs px-1.5 py-0.5 rounded" style="color: var(--text-muted); background-color: var(--bg-elevated)">default</span>
                  }
                </div>
                <p class="text-xs font-mono mt-0.5" style="color: var(--text-muted)">{{ env.slug }}</p>
              </div>

              <!-- ID para copiar -->
              <div class="text-right">
                <p class="text-xs font-mono" style="color: var(--text-muted)">{{ env.id.slice(0, 8) }}...</p>
                <p class="text-xs mt-0.5" style="color: var(--text-muted)">
                  {{ env.createdAt | date:'MMM d, y' }}
                </p>
              </div>

              <!-- Acciones -->
              <button (click)="confirmDelete(env)"
                class="transition-colors cursor-pointer text-xs ml-2"
                style="color: var(--text-muted)">
                Delete
              </button>

            </div>
          }
        </div>
      }

      <!-- Delete confirm -->
      @if (deletingEnv()) {
        <div class="fixed inset-0 flex items-center justify-center z-50 px-4" style="background-color: var(--bg-overlay)">
          <div class="border rounded-xl p-6 max-w-sm w-full" style="background-color: var(--bg-surface); border-color: var(--border)">
            <h3 class="text-sm font-medium mb-2" style="color: var(--text-primary)">Delete environment</h3>
            <p class="text-sm mb-5" style="color: var(--text-secondary)">
              This will permanently delete
              <span class="font-medium" style="color: var(--text-primary)">{{ deletingEnv()!.name }}</span>
              and all its flag values and SDK keys.
            </p>
            <div class="flex justify-end gap-2">
              <button (click)="deletingEnv.set(null)"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)">
                Cancel
              </button>
              <button (click)="deleteEnv()"
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
export class EnvironmentList implements OnInit {
  readonly projectId = input.required<string>();

  private readonly environmentsService = inject(EnvironmentsService);
  private readonly fb = inject(FormBuilder);

  readonly environments = signal<Environment[]>([]);
  readonly loading      = signal(true);
  readonly saving       = signal(false);
  readonly showForm     = signal(false);
  readonly formError    = signal<string | null>(null);
  readonly deletingEnv  = signal<Environment | null>(null);

  readonly presetColors = PRESET_COLORS;

  readonly form = this.fb.nonNullable.group({
    name:  ['', Validators.required],
    slug:  ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    color: ['#6366f1'],
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.environmentsService.findAll(this.projectId()).subscribe({
      next: (data) => {
        this.environments.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  create() {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.formError.set(null);

    const { name, slug, color } = this.form.getRawValue();

    this.environmentsService.create(this.projectId(), { name, slug, color }).subscribe({
      next: (env) => {
        this.environments.update((list) => [...list, env]);
        this.cancelForm();
        this.saving.set(false);
      },
      error: (err) => {
        this.formError.set(
          err.status === 409 ? 'Slug already taken.' : 'Something went wrong.',
        );
        this.saving.set(false);
      },
    });
  }

  confirmDelete(env: Environment) {
    this.deletingEnv.set(env);
  }

  deleteEnv() {
    const env = this.deletingEnv();
    if (!env) return;

    this.environmentsService.remove(this.projectId(), env.id).subscribe({
      next: () => {
        this.environments.update((list) => list.filter((e) => e.id !== env.id));
        this.deletingEnv.set(null);
      },
    });
  }

  cancelForm() {
    this.showForm.set(false);
    this.form.reset({ color: '#6366f1' });
    this.formError.set(null);
  }
}
