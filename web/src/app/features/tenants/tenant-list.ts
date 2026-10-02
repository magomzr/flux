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
  templateUrl: "tenant-list.html",
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
