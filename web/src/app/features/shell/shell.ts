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
  templateUrl: "shell.html",
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly authMe = inject(AuthMeService);
  private readonly fb = inject(FormBuilder);
  readonly theme = inject(ThemeService);

  readonly userName = computed(() => this.auth.user()?.name ?? "");
  readonly role = computed(() => this.auth.role() ?? "");
  readonly userInitial = computed(() => this.userName().charAt(0).toUpperCase());

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
          err.status === 401 ? "Current password is incorrect." : "Something went wrong.",
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
          label: "Auditoría",
          path: "/audit",
          icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 14l2 2 4-4",
        });
      }
      return items;
    }

    // Roles de tenant — siempre ven proyectos
    items.push({
      label: "Proyectos",
      path: "/projects",
      icon: "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z",
    });

    // Team — solo tenant_admin
    if (auth.hasPermission("write:user")) {
      items.push({
        label: "Equipo",
        path: "/users",
        icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
      });
    }

    // Billing — solo tenant_admin
    if (auth.hasPermission("read:billing") && auth.hasPermission("write:billing")) {
      items.push({
        label: "Facturación",
        path: "/billing",
        icon: "M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM1 10h22",
      });
    }

    // Audit — tenant_admin y developer
    if (auth.hasPermission("read:audit")) {
      items.push({
        label: "Auditoría",
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
