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
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <!-- Breadcrumb + header -->
      <div class="mb-6">
        <div class="flex items-center gap-2 text-xs mb-2" style="color: var(--text-muted)">
          <a
            routerLink="/tenants"
            class="transition-colors cursor-pointer hover:underline"
            style="color: var(--text-muted)"
            >Tenants</a
          >
          <span>/</span>
          <span style="color: var(--text-primary)">{{ tenant()?.name ?? tenantId() }}</span>
          <span>/</span>
          <span style="color: var(--text-primary)">Users</span>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-semibold" style="color: var(--text-primary)">
              {{ tenant()?.name ?? "Tenant" }} — Users
            </h1>
            <p class="text-sm mt-0.5" style="color: var(--text-muted)">
              {{ users().length }} members · {{ tenant()?.email }}
            </p>
          </div>
        </div>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="space-y-2">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="h-16 rounded-xl animate-pulse skeleton"></div>
          }
        </div>
      }

      <!-- Empty -->
      @if (!loading() && users().length === 0) {
        <div
          class="text-center py-16 border border-dashed rounded-xl"
          style="border-color: var(--border)"
        >
          <p class="text-sm" style="color: var(--text-muted)">No users in this tenant.</p>
        </div>
      }

      <!-- Table -->
      @if (!loading() && users().length > 0) {
        <div class="border rounded-xl overflow-hidden" style="border-color: var(--border)">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b" style="border-color: var(--border)">
                <th
                  class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium"
                  style="color: var(--text-muted)"
                >
                  Member
                </th>
                <th
                  class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium"
                  style="color: var(--text-muted)"
                >
                  Role
                </th>
                <th
                  class="text-left text-xs uppercase tracking-wider px-4 py-3 font-medium hidden md:table-cell"
                  style="color: var(--text-muted)"
                >
                  Last login
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
              @for (user of users(); track user.id) {
                <tr
                  class="border-b last:border-0 transition-colors"
                  style="border-color: var(--table-border)"
                >
                  <td class="px-4 py-3">
                    <p class="font-medium text-sm" style="color: var(--text-primary)">
                      {{ user.name }}
                    </p>
                    <p class="text-xs mt-0.5" style="color: var(--text-muted)">{{ user.email }}</p>
                  </td>

                  <td class="px-4 py-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full font-medium"
                      [style]="roleBadge(user.role)"
                    >
                      {{ roleLabel(user.role) }}
                    </span>
                  </td>

                  <td class="px-4 py-3 hidden md:table-cell">
                    <p class="text-xs" style="color: var(--text-muted)">
                      {{ user.lastLoginAt ? (user.lastLoginAt | date: "MMM d, y") : "Never" }}
                    </p>
                  </td>

                  <td class="px-4 py-3">
                    @if (user.isActive) {
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
                    <div class="flex items-center justify-end gap-3">
                      <button
                        (click)="openResetPassword(user)"
                        class="text-xs transition-colors cursor-pointer"
                        style="color: var(--text-muted)"
                      >
                        Reset password
                      </button>
                      <button
                        (click)="toggleActive(user)"
                        class="text-xs transition-colors cursor-pointer"
                        [style.color]="user.isActive ? 'var(--danger-fg)' : 'var(--accent-text)'"
                      >
                        {{ user.isActive ? "Deactivate" : "Activate" }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Reset password modal -->
      @if (resettingUser()) {
        <div
          class="fixed inset-0 flex items-center justify-center z-50 px-4"
          style="background-color: var(--bg-overlay)"
        >
          <div
            class="border rounded-xl p-6 max-w-sm w-full"
            style="background-color: var(--bg-surface); border-color: var(--border)"
          >
            <h3 class="text-sm font-medium mb-1" style="color: var(--text-primary)">
              Reset password
            </h3>
            <p class="text-xs mb-4" style="color: var(--text-muted)">
              Set a new temporary password for
              <span class="font-medium" style="color: var(--text-primary)">{{
                resettingUser()!.name
              }}</span>
              in
              <span class="font-medium" style="color: var(--text-primary)">{{
                tenant()?.name
              }}</span
              >.
            </p>

            <div class="flex gap-2 mb-2">
              <input
                [value]="resetPassword()"
                (input)="resetPassword.set($any($event.target).value)"
                type="text"
                placeholder="New password"
                class="flex-1 rounded-lg px-3 py-2 text-sm border font-mono focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
              />
              <button
                type="button"
                (click)="resetPassword.set(generatePwd())"
                class="text-xs px-3 py-2 rounded-lg border transition-colors cursor-pointer whitespace-nowrap"
                style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-elevated)"
              >
                Generate
              </button>
            </div>

            @if (resetPassword().length > 0 && resetPassword().length < 8) {
              <p class="text-xs mb-3" style="color: var(--warning-fg)">Minimum 8 characters</p>
            }

            <div class="flex justify-end gap-2 mt-4">
              <button
                (click)="cancelReset()"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)"
              >
                Cancel
              </button>
              <button
                (click)="confirmReset()"
                [disabled]="resetPassword().length < 8 || resetting()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style="background-color: var(--accent); color: var(--accent-fg)"
              >
                {{ resetting() ? "Saving..." : "Set password" }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
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
