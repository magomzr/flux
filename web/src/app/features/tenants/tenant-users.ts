import { Component, inject, signal, input, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DatePipe } from "@angular/common";
import { UsersService, TenantUser } from "../../core/api/users.service";
import { TenantsService } from "../../core/api/tenants.service";
import type { Tenant } from "../../core/models/api.models";

const ROLES = [
  { value: "tenant_admin", label: "Admin" },
  { value: "developer", label: "Developer" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_BADGE: Record<string, string> = {
  tenant_admin: "color: var(--accent-text); background-color: var(--accent-subtle)",
  developer: "color: var(--success-fg); background-color: var(--success-subtle)",
  editor: "color: var(--warning-fg); background-color: var(--warning-subtle)",
  viewer: "color: var(--text-secondary); background-color: var(--bg-elevated)",
};

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
  selector: "app-tenant-users",
  imports: [RouterLink, DatePipe],
  templateUrl: "tenant-users.html",
})
export class TenantUsers implements OnInit {
  readonly tenantId = input.required<string>();

  private readonly usersService = inject(UsersService);
  private readonly tenantsService = inject(TenantsService);

  readonly tenant = signal<Tenant | null>(null);
  readonly users = signal<TenantUser[]>([]);
  readonly loading = signal(true);
  readonly resettingUser = signal<TenantUser | null>(null);
  readonly resetPassword = signal("");
  readonly resetting = signal(false);

  readonly roles = ROLES;
  readonly generatePwd = generatePassword;

  ngOnInit() {
    const id = this.tenantId();

    // Cargar tenant y usuarios en paralelo
    this.tenantsService.findOne(id).subscribe({
      next: (t) => this.tenant.set(t),
    });

    this.usersService.findAll(id).subscribe({
      next: (data) => {
        this.users.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openResetPassword(user: TenantUser) {
    this.resettingUser.set(user);
    this.resetPassword.set(generatePassword());
  }

  confirmReset() {
    const user = this.resettingUser();
    const password = this.resetPassword();
    if (!user || password.length < 8) return;

    this.resetting.set(true);
    this.usersService.update(this.tenantId(), user.id, { password }).subscribe({
      next: () => {
        this.cancelReset();
        this.resetting.set(false);
      },
      error: () => this.resetting.set(false),
    });
  }

  cancelReset() {
    this.resettingUser.set(null);
    this.resetPassword.set("");
  }

  toggleActive(user: TenantUser) {
    this.usersService.update(this.tenantId(), user.id, { isActive: !user.isActive }).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      },
    });
  }

  roleBadge(role: string): string {
    return ROLE_BADGE[role] ?? ROLE_BADGE["viewer"];
  }

  roleLabel(role: string): string {
    return ROLES.find((r) => r.value === role)?.label ?? role;
  }
}
