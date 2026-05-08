import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TenantsService } from '../../core/api/tenants.service';
import type { Tenant } from '../../core/models/api.models';

@Component({
  selector: 'app-tenant-list',
  imports: [ReactiveFormsModule],
  template: `
    <div class="p-6 max-w-5xl mx-auto">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color: var(--text-primary)">Tenants</h1>
          <p class="text-sm mt-0.5" style="color: var(--text-muted)">{{ tenants().length }} total</p>
        </div>
        <button
          (click)="showForm.set(true)"
          class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          style="background-color: var(--accent); color: var(--accent-fg)"
        >
          + New tenant
        </button>
      </div>

      <!-- Create form -->
      @if (showForm()) {
        <div class="border rounded-xl p-5 mb-6" style="background-color: var(--bg-surface); border-color: var(--border)">
          <h2 class="text-sm font-medium mb-4" style="color: var(--text-primary)">New tenant</h2>
          <form [formGroup]="form" (ngSubmit)="create()" class="grid grid-cols-2 gap-4">

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Name</label>
              <input formControlName="name" placeholder="Acme Corp"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
            </div>

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Slug</label>
              <input formControlName="slug" placeholder="acme"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
            </div>

            <div class="space-y-1 col-span-2">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">Email</label>
              <input formControlName="email" type="email" placeholder="admin@acme.com"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)" />
            </div>

            @if (formError()) {
              <p class="col-span-2 text-xs rounded-lg px-3 py-2" style="color: var(--danger-fg); background-color: var(--danger-subtle); border: 1px solid var(--danger-fg)">
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
                {{ saving() ? 'Creating...' : 'Create tenant' }}
              </button>
            </div>

          </form>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="space-y-2">
          @for (_ of [1,2,3]; track $index) {
            <div class="h-16 rounded-xl animate-pulse skeleton"></div>
          }
        </div>
      }

      <!-- Empty -->
      @if (!loading() && tenants().length === 0) {
        <div class="text-center py-16">
          <p class="text-sm" style="color: var(--text-muted)">No tenants yet.</p>
        </div>
      }

      <!-- Table -->
      @if (!loading() && tenants().length > 0) {
        <div class="border rounded-xl overflow-hidden" style="border-color: var(--border)">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b" style="border-color: var(--border)">
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Name</th>
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Slug</th>
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Email</th>
                <th class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium" style="color: var(--text-muted)">Status</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (tenant of tenants(); track tenant.id) {
                <tr class="border-b last:border-0 transition-colors" style="border-color: var(--table-border)">
                  <td class="px-4 py-3 font-medium" style="color: var(--text-primary)">{{ tenant.name }}</td>
                  <td class="px-4 py-3 font-mono text-xs" style="color: var(--text-secondary)">{{ tenant.slug }}</td>
                  <td class="px-4 py-3" style="color: var(--text-secondary)">{{ tenant.email }}</td>
                  <td class="px-4 py-3">
                    @if (tenant.isActive) {
                      <span class="inline-flex items-center gap-1.5 text-xs" style="color: var(--success-fg)">
                        <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--success-fg)"></span>
                        Active
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 text-xs" style="color: var(--text-muted)">
                        <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--text-muted)"></span>
                        Inactive
                      </span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-2">
                      @if (tenant.isActive) {
                        <button (click)="deactivate(tenant)"
                          class="text-xs transition-colors cursor-pointer"
                          style="color: var(--text-muted)">
                          Deactivate
                        </button>
                      }
                      <button (click)="confirmDelete(tenant)"
                        class="text-xs transition-colors cursor-pointer"
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

      <!-- Delete confirm dialog -->
      @if (deletingTenant()) {
        <div class="fixed inset-0 flex items-center justify-center z-50 px-4" style="background-color: var(--bg-overlay)">
          <div class="border rounded-xl p-6 max-w-sm w-full" style="background-color: var(--bg-surface); border-color: var(--border)">
            <h3 class="text-sm font-medium mb-2" style="color: var(--text-primary)">Delete tenant</h3>
            <p class="text-sm mb-5" style="color: var(--text-secondary)">
              This will permanently delete <span class="font-medium" style="color: var(--text-primary)">{{ deletingTenant()!.name }}</span>
              and all its data. This cannot be undone.
            </p>
            <div class="flex justify-end gap-2">
              <button (click)="deletingTenant.set(null)"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)">
                Cancel
              </button>
              <button (click)="deleteTenant()"
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
export class TenantList implements OnInit {
  private readonly tenantsService = inject(TenantsService);
  private readonly fb = inject(FormBuilder);

  readonly tenants  = signal<Tenant[]>([]);
  readonly loading  = signal(true);
  readonly saving   = signal(false);
  readonly showForm = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingTenant = signal<Tenant | null>(null);

  readonly form = this.fb.nonNullable.group({
    name:  ['', Validators.required],
    slug:  ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.tenantsService.findAll().subscribe({
      next: (data) => {
        this.tenants.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  create() {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.formError.set(null);

    this.tenantsService.create(this.form.getRawValue()).subscribe({
      next: (tenant) => {
        this.tenants.update((list) => [tenant, ...list]);
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

  deactivate(tenant: Tenant) {
    this.tenantsService.deactivate(tenant.id).subscribe({
      next: (updated) => {
        this.tenants.update((list) =>
          list.map((t) => (t.id === updated.id ? updated : t)),
        );
      },
    });
  }

  confirmDelete(tenant: Tenant) {
    this.deletingTenant.set(tenant);
  }

  deleteTenant() {
    const tenant = this.deletingTenant();
    if (!tenant) return;

    this.tenantsService.remove(tenant.id).subscribe({
      next: () => {
        this.tenants.update((list) => list.filter((t) => t.id !== tenant.id));
        this.deletingTenant.set(null);
      },
    });
  }

  cancelForm() {
    this.showForm.set(false);
    this.form.reset();
    this.formError.set(null);
  }
}
