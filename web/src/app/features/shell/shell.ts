import { Component, inject, computed, signal } from "@angular/core";
import { RouterOutlet, RouterLink, RouterLinkActive } from "@angular/router";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { AuthService } from "../../core/auth/auth.service";
import { ThemeService } from "../../core/theme/theme.service";
import { AuthMeService } from "../../core/api/auth-me.service";

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: "app-shell",
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReactiveFormsModule],
  template: `
    <div
      class="flex h-screen overflow-hidden"
      style="background-color: var(--bg-base)"
    >
      <!-- Sidebar -->
      <aside
        class="w-56 flex-shrink-0 flex flex-col border-r"
        style="background-color: var(--sidebar-bg); border-color: var(--sidebar-border)"
      >
        <!-- Logo -->
        <div
          class="h-14 flex items-center px-4 border-b"
          style="border-color: var(--sidebar-border)"
        >
          <span
            class="text-lg font-semibold tracking-tight"
            style="color: var(--text-primary)"
          >
            flux
          </span>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-2 py-3 space-y-1.5 overflow-y-auto">
          @for (item of navItems(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="sidebar-active"
              class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors hover:opacity-80"
              style="background-color: var(--bg-elevated); color: var(--text-secondary)"
              [routerLinkActiveOptions]="{ exact: false }"
            >
              <svg
                class="w-4 h-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path [attr.d]="item.icon" />
              </svg>
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- Footer: user + theme toggle -->
        <div
          class="border-t p-3 space-y-3"
          style="border-color: var(--sidebar-border)"
        >
          <!-- Theme toggle -->
          <button
            (click)="theme.toggle()"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer hover:opacity-80"
            style="background-color: var(--bg-elevated); color: var(--text-secondary)"
          >
            @if (theme.isDark()) {
              <svg
                class="w-4 h-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="5" />
                <path
                  d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                />
              </svg>
              <span>Light mode</span>
            } @else {
              <svg
                class="w-4 h-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark mode</span>
            }
          </button>

          <!-- User -->
          <div class="flex items-center gap-2.5 px-2 py-1.5">
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 text-white"
              style="background-color: var(--accent)"
            >
              {{ userInitial() }}
            </div>
            <div class="flex-1 min-w-0">
              <p
                class="text-xs font-medium truncate"
                style="color: var(--text-primary)"
              >
                {{ userName() }}
              </p>
              <button
                (click)="showChangePassword.set(true)"
                class="text-xs transition-colors cursor-pointer text-left"
                style="color: var(--text-muted)"
              >
                Change password
              </button>
            </div>
            <button
              (click)="logout()"
              title="Sign out"
              class="p-1.5 rounded-lg transition-colors cursor-pointer hover:opacity-80"
              style="background-color: var(--bg-elevated); color: var(--text-muted)"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main -->
      <main
        class="flex-1 overflow-y-auto"
        style="background-color: var(--bg-base)"
      >
        <router-outlet />
      </main>
    </div>

    <!-- Change password modal -->
    @if (showChangePassword()) {
      <div
        class="fixed inset-0 flex items-center justify-center z-50 px-4"
        style="background-color: var(--bg-overlay)"
      >
        <div
          class="border rounded-xl p-6 max-w-sm w-full"
          style="background-color: var(--bg-surface); border-color: var(--border)"
        >
          <h3
            class="text-sm font-medium mb-4"
            style="color: var(--text-primary)"
          >
            Change password
          </h3>

          <form
            [formGroup]="pwForm"
            (ngSubmit)="submitChangePassword()"
            class="space-y-3"
          >
            <div class="space-y-1">
              <label
                class="text-xs uppercase tracking-wider"
                style="color: var(--text-muted)"
                >Current password</label
              >
              <input
                formControlName="currentPassword"
                type="password"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
              />
            </div>
            <div class="space-y-1">
              <label
                class="text-xs uppercase tracking-wider"
                style="color: var(--text-muted)"
                >New password</label
              >
              <input
                formControlName="newPassword"
                type="password"
                placeholder="Min. 8 characters"
                class="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:border-transparent"
                style="background-color: var(--input-bg); border-color: var(--input-border); color: var(--text-primary); --tw-ring-color: var(--input-focus)"
              />
            </div>

            @if (pwError()) {
              <p
                class="text-xs rounded-lg px-3 py-2"
                style="color: var(--danger-fg); background-color: var(--danger-subtle); border: 1px solid var(--danger-fg)"
              >
                {{ pwError() }}
              </p>
            }
            @if (pwSuccess()) {
              <p
                class="text-xs rounded-lg px-3 py-2"
                style="color: var(--success-fg); background-color: var(--success-subtle)"
              >
                Password updated successfully.
              </p>
            }

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                (click)="cancelChangePassword()"
                class="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="pwForm.invalid || pwSaving()"
                class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style="background-color: var(--accent); color: var(--accent-fg)"
              >
                {{ pwSaving() ? "Saving..." : "Update password" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly authMe = inject(AuthMeService);
  private readonly fb = inject(FormBuilder);
  readonly theme = inject(ThemeService);

  readonly userName = computed(() => this.auth.user()?.name ?? "");
  readonly role = computed(() => this.auth.role() ?? "");
  readonly userInitial = computed(() =>
    this.userName().charAt(0).toUpperCase(),
  );

  // Change password state
  readonly showChangePassword = signal(false);
  readonly pwSaving = signal(false);
  readonly pwError = signal<string | null>(null);
  readonly pwSuccess = signal(false);

  readonly pwForm = this.fb.nonNullable.group({
    currentPassword: ["", Validators.required],
    newPassword: ["", [Validators.required, Validators.minLength(8)]],
  });

  submitChangePassword() {
    if (this.pwForm.invalid || this.pwSaving()) return;
    this.pwSaving.set(true);
    this.pwError.set(null);
    this.pwSuccess.set(false);

    this.authMe.changePassword(this.pwForm.getRawValue()).subscribe({
      next: () => {
        this.pwSuccess.set(true);
        this.pwSaving.set(false);
        this.pwForm.reset();
        setTimeout(() => this.cancelChangePassword(), 1500);
      },
      error: (err) => {
        this.pwError.set(
          err.status === 401
            ? "Current password is incorrect."
            : "Something went wrong.",
        );
        this.pwSaving.set(false);
      },
    });
  }

  cancelChangePassword() {
    this.showChangePassword.set(false);
    this.pwForm.reset();
    this.pwError.set(null);
    this.pwSuccess.set(false);
  }

  readonly navItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [];
    const auth = this.auth;

    // Roles internos
    if (auth.isInternal()) {
      items.push({
        label: "Tenants",
        path: "/tenants",
        icon: "M3 21h18M3 7v14M21 7v14M6 21V10M10 21V10M14 21V10M18 21V10M3 7l9-4 9 4",
      });
      if (auth.isOps()) {
        items.push({
          label: "Audit log",
          path: "/audit",
          icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 14l2 2 4-4",
        });
      }
      return items;
    }

    // Roles de tenant — siempre ven proyectos
    items.push({
      label: "Projects",
      path: "/projects",
      icon: "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z",
    });

    // Team — solo tenant_admin
    if (auth.hasPermission("write:user")) {
      items.push({
        label: "Team",
        path: "/users",
        icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
      });
    }

    // Billing — solo tenant_admin
    if (
      auth.hasPermission("read:billing") &&
      auth.hasPermission("write:billing")
    ) {
      items.push({
        label: "Billing",
        path: "/billing",
        icon: "M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM1 10h22",
      });
    }

    // Audit — tenant_admin y developer
    if (auth.hasPermission("read:audit")) {
      items.push({
        label: "Audit log",
        path: "/audit",
        icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 14l2 2 4-4",
      });
    }

    return items;
  });

  logout(): void {
    this.auth.logout();
  }
}
