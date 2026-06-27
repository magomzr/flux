import { Component, inject, signal, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { UsersService, TenantUser } from "../../core/api/users.service";
import { AuthService } from "../../core/auth/auth.service";

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

/** Genera una contraseña segura de 16 caracteres */
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  // Garantizar al menos uno de cada tipo
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  const rest = Array.from({ length: 12 }, () => all[Math.floor(Math.random() * all.length)]);

  // Mezclar para que los requeridos no estén siempre al inicio
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

@Component({
  selector: "app-user-list",
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color: var(--text-primary)">Team</h1>
          <p class="text-sm mt-0.5" style="color: var(--text-muted)">
            {{ users().length }} members
          </p>
        </div>
        <button
          (click)="showForm.set(true)"
          class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          style="background-color: var(--accent); color: var(--accent-fg)"
        >
          + Invite member
        </button>
      </div>

      <!-- Create form -->
      @if (showForm()) {
        <div
          class="border rounded-xl p-5 mb-6"
          style="background-color: var(--bg-surface); border-color: var(--border)"
        >
          <h2 class="text-sm font-medium mb-4" style="color: var(--text-primary)">
            New team member
          </h2>
          <form [formGroup]="form" (ngSubmit)="create()" class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)"
                >Name</label
              >
              <input
                formControlName="name"
                placeholder="Jane Smith"
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
                placeholder="jane@company.com"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)"
                >Role</label
              >
              <select
                formControlName="role"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
              >
                @for (r of roles; track r.value) {
                  <option [value]="r.value">{{ r.label }}</option>
                }
              </select>
            </div>

            <!-- Password con generate -->
            <div class="space-y-1">
              <label class="text-xs uppercase tracking-wider" style="color: var(--text-muted)">
                Temporary password
              </label>
              <div class="flex gap-2">
                <input
                  formControlName="password"
                  type="text"
                  placeholder="Min. 8 characters"
                  class="flex-1 rounded-lg px-3 py-2 text-sm border font-mono focus:outline-none focus:ring-2 focus:border-transparent"
                  style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
                />
                <button
                  type="button"
                  (click)="fillGeneratedPassword()"
                  class="text-xs px-3 py-2 rounded-lg border transition-colors cursor-pointer whitespace-nowrap"
                  style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-elevated)"
                  title="Generate secure password"
                >
                  Generate
                </button>
              </div>
            </div>

            @if (formError()) {
              <p
                class="col-span-2 text-xs rounded-lg px-3 py-2"
                style="color: var(--danger-fg); background-color: var(--danger-subtle); border: 1px solid var(--danger-fg)"
              >
                {{ formError() }}
              </p>
            }

            <div class="col-span-2 flex justify-end gap-2">
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
                {{ saving() ? "Creating..." : "Create member" }}
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
      @if (!loading() && users().length === 0) {
        <div
          class="text-center py-16 border border-dashed rounded-xl"
          style="border-color: var(--border)"
        >
          <p class="text-sm" style="color: var(--text-muted)">No team members yet.</p>
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
                      @if (user.isActive) {
                        <button
                          (click)="toggleActive(user)"
                          class="text-xs transition-colors cursor-pointer"
                          style="color: var(--danger-fg)"
                        >
                          Deactivate
                        </button>
                      } @else {
                        <button
                          (click)="toggleActive(user)"
                          class="text-xs transition-colors cursor-pointer"
                          style="color: var(--accent-text)"
                        >
                          Activate
                        </button>
                      }
                      <button
                        (click)="confirmDelete(user)"
                        class="text-xs transition-colors cursor-pointer"
                        style="color: var(--danger-fg)"
                      >
                        Remove
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
              }}</span
              >. Share it securely — they should change it on first login.
            </p>

            <div class="space-y-3">
              <div class="flex gap-2">
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
                  (click)="generateResetPassword()"
                  class="text-xs px-3 py-2 rounded-lg border transition-colors cursor-pointer whitespace-nowrap"
                  style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-elevated)"
                >
                  Generate
                </button>
              </div>

              @if (resetPassword().length > 0 && resetPassword().length < 8) {
                <p class="text-xs" style="color: var(--warning-fg)">Minimum 8 characters</p>
              }
            </div>

            <div class="flex justify-end gap-2 mt-5">
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

      <!-- Delete confirm -->
      @if (deletingUser()) {
        <div
          class="fixed inset-0 flex items-center justify-center z-50 px-4"
          style="background-color: var(--bg-overlay)"
        >
          <div
            class="border rounded-xl p-6 max-w-sm w-full"
            style="background-color: var(--bg-surface); border-color: var(--border)"
          >
            <h3 class="text-sm font-medium mb-2" style="color: var(--text-primary)">
              Remove member
            </h3>
            <p class="text-sm mb-5" style="color: var(--text-secondary)">
              Remove
              <span class="font-medium" style="color: var(--text-primary)">{{
                deletingUser()!.name
              }}</span>
              from this team? They will lose access immediately.
            </p>
            <div class="flex justify-end gap-2">
              <button
                (click)="deletingUser.set(null)"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)"
              >
                Cancel
              </button>
              <button
                (click)="deleteUser()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="background-color: var(--danger); color: #fff"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class UserList implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<TenantUser[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly formError = signal<string | null>(null);
  readonly deletingUser = signal<TenantUser | null>(null);

  // Reset password state
  readonly resettingUser = signal<TenantUser | null>(null);
  readonly resetPassword = signal("");
  readonly resetting = signal(false);

  readonly roles = ROLES;

  readonly form = this.fb.nonNullable.group({
    name: ["", Validators.required],
    email: ["", [Validators.required, Validators.email]],
    role: ["developer"],
    password: ["", [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.usersService.findAll(tenantId).subscribe({
      next: (data) => {
        this.users.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  fillGeneratedPassword() {
    this.form.patchValue({ password: generatePassword() });
  }

  create() {
    if (this.form.invalid || this.saving()) return;

    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.saving.set(true);
    this.formError.set(null);

    this.usersService.create(tenantId, this.form.getRawValue()).subscribe({
      next: (user) => {
        this.users.update((list) => [...list, user]);
        this.cancelForm();
        this.saving.set(false);
      },
      error: (err) => {
        this.formError.set(err.status === 409 ? "Email already taken." : "Something went wrong.");
        this.saving.set(false);
      },
    });
  }

  cancelForm() {
    this.showForm.set(false);
    this.form.reset({ role: "developer" });
    this.formError.set(null);
  }

  // ─── Reset password ───────────────────────────────────────────────────────

  openResetPassword(user: TenantUser) {
    this.resettingUser.set(user);
    this.resetPassword.set(generatePassword()); // pre-fill con una generada
  }

  generateResetPassword() {
    this.resetPassword.set(generatePassword());
  }

  confirmReset() {
    const user = this.resettingUser();
    const tenantId = this.auth.tenantId();
    const password = this.resetPassword();
    if (!user || !tenantId || password.length < 8) return;

    this.resetting.set(true);
    this.usersService.update(tenantId, user.id, { password }).subscribe({
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

  // ─── Toggle active / delete ───────────────────────────────────────────────

  toggleActive(user: TenantUser) {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return;

    this.usersService.update(tenantId, user.id, { isActive: !user.isActive }).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      },
    });
  }

  confirmDelete(user: TenantUser) {
    this.deletingUser.set(user);
  }

  deleteUser() {
    const user = this.deletingUser();
    const tenantId = this.auth.tenantId();
    if (!user || !tenantId) return;

    this.usersService.remove(tenantId, user.id).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        this.deletingUser.set(null);
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  roleBadge(role: string): string {
    return ROLE_BADGE[role] ?? ROLE_BADGE["viewer"];
  }

  roleLabel(role: string): string {
    return ROLES.find((r) => r.value === role)?.label ?? role;
  }
}
