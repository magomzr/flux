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
  templateUrl: "user-list.html",
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
