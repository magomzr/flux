import { Component, inject, signal, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { TenantsService } from "../../core/api/tenants.service";
import { BillingService } from "../../core/api/billing.service";
import type { Tenant, Plan } from "../../core/models/api.models";

interface NewTenantCredentials {
  tenantName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  const rest = Array.from({ length: 12 }, () => all[Math.floor(Math.random() * all.length)]);
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

@Component({
  selector: "app-tenant-list",
  imports: [ReactiveFormsModule],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color: var(--text-primary)">Tenants</h1>
          <p class="text-sm mt-0.5" style="color: var(--text-muted)">
            {{ tenants().length }} total
          </p>
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
        <div
          class="border rounded-xl p-5 mb-6"
          style="background-color: var(--bg-surface); border-color: var(--border)"
        >
          <h2 class="text-sm font-medium mb-1" style="color: var(--text-primary)">New tenant</h2>
          <p class="text-xs mb-4" style="color: var(--text-muted)">
            A <strong>tenant_admin</strong> account will be created automatically with the
            credentials below.
          </p>

          <form [formGroup]="form" (ngSubmit)="create()" class="space-y-5">
            <!-- Tenant info -->
            <div>
              <p
                class="text-xs uppercase tracking-wider mb-3 font-medium"
                style="color: var(--text-muted)"
              >
                Tenant
              </p>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)"
                    >Name</label
                  >
                  <input
                    formControlName="name"
                    placeholder="Acme Corp"
                    class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                    style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)"
                    >Slug</label
                  >
                  <input
                    formControlName="slug"
                    placeholder="acme"
                    class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                    style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
                  />
                </div>
                <div class="space-y-1 col-span-2">
                  <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)"
                    >Billing email</label
                  >
                  <input
                    formControlName="email"
                    type="email"
                    placeholder="billing@acme.com"
                    class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                    style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
                  />
                </div>
              </div>
            </div>

            <!-- Admin user -->
            <div formGroupName="admin">
              <p
                class="text-xs uppercase tracking-wider mb-3 font-medium"
                style="color: var(--text-muted)"
              >
                Admin account
              </p>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)"
                    >Name</label
                  >
                  <input
                    formControlName="name"
                    placeholder="John Doe"
                    class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                    style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)"
                    >Email</label
                  >
                  <input
                    formControlName="email"
                    type="email"
                    placeholder="admin@acme.com"
                    class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                    style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
                  />
                </div>
                <div class="space-y-1 col-span-2">
                  <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">
                    Temporary password
                    <span class="normal-case ml-1" style="color: var(--text-muted)"
                      >(min. 8 characters)</span
                    >
                  </label>
                  <div class="flex gap-2">
                    <input
                      formControlName="password"
                      type="text"
                      placeholder="••••••••"
                      class="flex-1 rounded-lg px-3 py-2 text-sm border font-mono focus:outline-none focus:ring-2 focus:border-transparent"
                      style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
                    />
                    <button
                      type="button"
                      (click)="fillAdminPassword()"
                      class="text-xs px-3 py-2 rounded-lg border transition-colors cursor-pointer whitespace-nowrap"
                      style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-elevated)"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Plan -->
            <div>
              <p
                class="text-xs uppercase tracking-wider mb-3 font-medium"
                style="color: var(--text-muted)"
              >
                Plan
              </p>
              <div class="grid grid-cols-3 gap-3">
                @for (plan of plans(); track plan.id) {
                  <button
                    type="button"
                    (click)="form.patchValue({ planId: plan.id })"
                    class="border rounded-lg p-3 text-left transition-colors cursor-pointer"
                    [style.border-color]="
                      form.value.planId === plan.id ? 'var(--accent)' : 'var(--border)'
                    "
                    [style.background-color]="
                      form.value.planId === plan.id ? 'var(--accent-subtle)' : 'var(--bg-elevated)'
                    "
                  >
                    <p class="text-sm font-medium" style="color: var(--text-primary)">
                      {{ plan.name }}
                    </p>
                    <p class="text-xs mt-0.5" style="color: var(--text-muted)">
                      {{ plan.priceUsd === 0 ? "Free" : "$" + plan.priceUsd / 100 + "/mo" }}
                    </p>
                  </button>
                }
              </div>
            </div>

            @if (formError()) {
              <p
                class="text-xs rounded-lg px-3 py-2"
                style="color: var(--danger-fg); background-color: var(--danger-subtle); border: 1px solid var(--danger-fg)"
              >
                {{ formError() }}
              </p>
            }

            <div class="flex justify-end gap-2">
              <button
                type="button"
                (click)="cancelForm()"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="form.invalid || saving()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style="background-color: var(--accent); color: var(--accent-fg)"
              >
                {{ saving() ? "Creating..." : "Create tenant" }}
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="space-y-2">
          @for (_ of [1, 2, 3]; track $index) {
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
                <th
                  class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium"
                  style="color: var(--text-muted)"
                >
                  Name
                </th>
                <th
                  class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium"
                  style="color: var(--text-muted)"
                >
                  Slug
                </th>
                <th
                  class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium"
                  style="color: var(--text-muted)"
                >
                  Email
                </th>
                <th
                  class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium"
                  style="color: var(--text-muted)"
                >
                  Status
                </th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (tenant of tenants(); track tenant.id) {
                <tr
                  class="border-b last:border-0 transition-colors"
                  style="border-color: var(--table-border)"
                >
                  <td class="px-4 py-3 font-medium" style="color: var(--text-primary)">
                    {{ tenant.name }}
                  </td>
                  <td class="px-4 py-3 font-mono text-xs" style="color: var(--text-secondary)">
                    {{ tenant.slug }}
                  </td>
                  <td class="px-4 py-3" style="color: var(--text-secondary)">{{ tenant.email }}</td>
                  <td class="px-4 py-3">
                    @if (tenant.isActive) {
                      <span
                        class="inline-flex items-center gap-1.5 text-xs"
                        style="color: var(--success-fg)"
                      >
                        <span
                          class="w-1.5 h-1.5 rounded-full"
                          style="background-color: var(--success-fg)"
                        ></span>
                        Active
                      </span>
                    } @else {
                      <span
                        class="inline-flex items-center gap-1.5 text-xs"
                        style="color: var(--text-muted)"
                      >
                        <span
                          class="w-1.5 h-1.5 rounded-full"
                          style="background-color: var(--text-muted)"
                        ></span>
                        Inactive
                      </span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        (click)="goToUsers(tenant)"
                        class="text-xs transition-colors cursor-pointer"
                        style="color: var(--accent-text)"
                      >
                        Users
                      </button>
                      <button
                        (click)="openChangePlan(tenant)"
                        class="text-xs transition-colors cursor-pointer"
                        style="color: var(--accent-text)"
                      >
                        Plan
                      </button>
                      @if (tenant.isActive) {
                        <button
                          (click)="deactivate(tenant)"
                          class="text-xs transition-colors cursor-pointer"
                          style="color: var(--danger-fg)"
                        >
                          Deactivate
                        </button>
                      }
                      <button
                        (click)="confirmDelete(tenant)"
                        class="text-xs transition-colors cursor-pointer"
                        style="color: var(--danger-fg)"
                      >
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

      <!-- Credentials modal — shown once after tenant creation -->
      @if (newCredentials()) {
        <div
          class="fixed inset-0 flex items-center justify-center z-50 px-4"
          style="background-color: var(--bg-overlay)"
        >
          <div
            class="border rounded-xl p-6 max-w-md w-full"
            style="background-color: var(--bg-surface); border-color: var(--border)"
          >
            <h3 class="text-sm font-medium mb-1" style="color: var(--text-primary)">
              Tenant created — save these credentials
            </h3>
            <p class="text-xs mb-4" style="color: var(--text-muted)">
              The admin password is shown only once. Copy it now and share it securely with the
              client.
            </p>

            <div class="space-y-3 mb-5">
              <div class="rounded-lg px-3 py-2.5" style="background-color: var(--bg-elevated)">
                <p class="text-xs mb-1" style="color: var(--text-muted)">Tenant</p>
                <p class="text-sm font-medium" style="color: var(--text-primary)">
                  {{ newCredentials()!.tenantName }}
                </p>
              </div>
              <div class="rounded-lg px-3 py-2.5" style="background-color: var(--bg-elevated)">
                <p class="text-xs mb-1" style="color: var(--text-muted)">Admin name</p>
                <p class="text-sm" style="color: var(--text-primary)">
                  {{ newCredentials()!.adminName }}
                </p>
              </div>
              <div class="rounded-lg px-3 py-2.5" style="background-color: var(--bg-elevated)">
                <p class="text-xs mb-1" style="color: var(--text-muted)">Admin email</p>
                <p class="text-sm font-mono" style="color: var(--text-primary)">
                  {{ newCredentials()!.adminEmail }}
                </p>
              </div>
              <div class="rounded-lg px-3 py-2.5" style="background-color: var(--mono-bg)">
                <p class="text-xs mb-1" style="color: var(--text-muted)">Temporary password</p>
                <p class="text-sm font-mono font-semibold" style="color: var(--success-fg)">
                  {{ newCredentials()!.adminPassword }}
                </p>
              </div>
            </div>

            <div class="flex justify-end">
              <button
                (click)="newCredentials.set(null)"
                class="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="background-color: var(--accent); color: var(--accent-fg)"
              >
                I've saved the credentials
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Change plan modal -->
      @if (changingPlanTenant()) {
        <div
          class="fixed inset-0 flex items-center justify-center z-50 px-4"
          style="background-color: var(--bg-overlay)"
        >
          <div
            class="border rounded-xl p-6 max-w-sm w-full"
            style="background-color: var(--bg-surface); border-color: var(--border)"
          >
            <h3 class="text-sm font-medium mb-1" style="color: var(--text-primary)">
              Change plan — {{ changingPlanTenant()!.name }}
            </h3>
            <p class="text-xs mb-4" style="color: var(--text-muted)">
              Select the new plan for this tenant.
            </p>
            <div class="grid grid-cols-1 gap-2 mb-5">
              @for (plan of plans(); track plan.id) {
                <button
                  type="button"
                  (click)="selectedPlanId.set(plan.id)"
                  class="border rounded-lg px-4 py-3 text-left transition-colors cursor-pointer flex items-center justify-between"
                  [style.border-color]="
                    selectedPlanId() === plan.id ? 'var(--accent)' : 'var(--border)'
                  "
                  [style.background-color]="
                    selectedPlanId() === plan.id ? 'var(--accent-subtle)' : 'transparent'
                  "
                >
                  <span class="text-sm font-medium" style="color: var(--text-primary)">{{
                    plan.name
                  }}</span>
                  <span class="text-xs" style="color: var(--text-muted)">
                    {{ plan.priceUsd === 0 ? "Free" : "$" + plan.priceUsd / 100 + "/mo" }}
                  </span>
                </button>
              }
            </div>
            <div class="flex justify-end gap-2">
              <button
                (click)="cancelChangePlan()"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)"
              >
                Cancel
              </button>
              <button
                (click)="confirmChangePlan()"
                [disabled]="!selectedPlanId() || planSaving()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style="background-color: var(--accent); color: var(--accent-fg)"
              >
                {{ planSaving() ? "Saving..." : "Apply plan" }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete confirm -->
      @if (deletingTenant()) {
        <div
          class="fixed inset-0 flex items-center justify-center z-50 px-4"
          style="background-color: var(--bg-overlay)"
        >
          <div
            class="border rounded-xl p-6 max-w-sm w-full"
            style="background-color: var(--bg-surface); border-color: var(--border)"
          >
            <h3 class="text-sm font-medium mb-2" style="color: var(--text-primary)">
              Delete tenant
            </h3>
            <p class="text-sm mb-5" style="color: var(--text-secondary)">
              This will permanently delete
              <span class="font-medium" style="color: var(--text-primary)">{{
                deletingTenant()!.name
              }}</span>
              and all its data. This cannot be undone.
            </p>
            <div class="flex justify-end gap-2">
              <button
                (click)="deletingTenant.set(null)"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)"
              >
                Cancel
              </button>
              <button
                (click)="deleteTenant()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="background-color: var(--danger); color: #fff"
              >
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
  private readonly billingService = inject(BillingService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly tenants = signal<Tenant[]>([]);
  readonly plans = signal<Plan[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly planSaving = signal(false);
  readonly showForm = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingTenant = signal<Tenant | null>(null);
  readonly newCredentials = signal<NewTenantCredentials | null>(null);
  readonly changingPlanTenant = signal<Tenant | null>(null);
  readonly selectedPlanId = signal<string>("");

  readonly form = this.fb.nonNullable.group({
    name: ["", Validators.required],
    slug: ["", [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    email: ["", [Validators.required, Validators.email]],
    planId: ["starter"],
    admin: this.fb.nonNullable.group({
      name: ["", Validators.required],
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(8)]],
    }),
  });

  ngOnInit() {
    this.load();
    this.billingService.getPlans().subscribe({
      next: (data) => {
        this.plans.set(data);
        // Pre-select first plan
        if (data.length > 0 && !this.form.value.planId) {
          this.form.patchValue({ planId: data[0].id });
        }
      },
    });
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

    const { planId, ...rest } = this.form.getRawValue();

    this.tenantsService.create(rest).subscribe({
      next: (response: any) => {
        const { admin: _admin, ...tenant } = response;
        this.tenants.update((list) => [tenant, ...list]);

        // Suscribir al plan seleccionado
        if (planId) {
          this.billingService.subscribe(tenant.id, planId).subscribe();
        }

        this.newCredentials.set({
          tenantName: tenant.name,
          adminName: response.admin.name,
          adminEmail: response.admin.email,
          adminPassword: response.admin.password,
        });

        this.cancelForm();
        this.saving.set(false);
      },
      error: (err) => {
        this.formError.set(err.status === 409 ? "Slug already taken." : "Something went wrong.");
        this.saving.set(false);
      },
    });
  }

  goToUsers(tenant: Tenant) {
    this.router.navigate(["/tenants", tenant.id, "users"]);
  }

  openChangePlan(tenant: Tenant) {
    this.changingPlanTenant.set(tenant);
    this.selectedPlanId.set("");
  }

  confirmChangePlan() {
    const tenant = this.changingPlanTenant();
    const planId = this.selectedPlanId();
    if (!tenant || !planId) return;

    this.planSaving.set(true);
    this.billingService.subscribe(tenant.id, planId).subscribe({
      next: () => {
        this.cancelChangePlan();
        this.planSaving.set(false);
      },
      error: () => this.planSaving.set(false),
    });
  }

  cancelChangePlan() {
    this.changingPlanTenant.set(null);
    this.selectedPlanId.set("");
  }

  deactivate(tenant: Tenant) {
    this.tenantsService.deactivate(tenant.id).subscribe({
      next: (updated) => {
        this.tenants.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
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

  fillAdminPassword() {
    this.form.get("admin")?.patchValue({ password: generatePassword() } as any);
  }
}
