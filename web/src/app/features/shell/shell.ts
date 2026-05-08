import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen overflow-hidden" style="background-color: var(--bg-base)">

      <!-- Sidebar -->
      <aside class="w-56 flex-shrink-0 flex flex-col border-r"
             style="background-color: var(--sidebar-bg); border-color: var(--sidebar-border)">

        <!-- Logo -->
        <div class="h-14 flex items-center px-4 border-b"
             style="border-color: var(--sidebar-border)">
          <span class="text-lg font-semibold tracking-tight" style="color: var(--text-primary)">
            flux
          </span>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          @for (item of navItems(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="sidebar-active"
              class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style="color: var(--text-secondary)"
              [routerLinkActiveOptions]="{ exact: false }"
            >
              <span class="text-base leading-none">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- Footer: user + theme toggle -->
        <div class="border-t p-3 space-y-2"
             style="border-color: var(--sidebar-border)">

          <!-- Theme toggle -->
          <button
            (click)="theme.toggle()"
            class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer"
            style="color: var(--text-muted)"
          >
            @if (theme.isDark()) {
              <span class="text-base">☀️</span>
              <span>Light mode</span>
            } @else {
              <span class="text-base">🌙</span>
              <span>Dark mode</span>
            }
          </button>

          <!-- User -->
          <div class="flex items-center gap-2.5 px-2 py-1.5">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 text-white"
                 style="background-color: var(--accent)">
              {{ userInitial() }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium truncate" style="color: var(--text-primary)">
                {{ userName() }}
              </p>
              <p class="text-xs truncate" style="color: var(--text-muted)">{{ role() }}</p>
            </div>
            <button
              (click)="logout()"
              title="Sign out"
              class="transition-colors cursor-pointer text-sm"
              style="color: var(--text-muted)"
            >
              ↪
            </button>
          </div>

        </div>
      </aside>

      <!-- Main -->
      <main class="flex-1 overflow-y-auto" style="background-color: var(--bg-base)">
        <router-outlet />
      </main>

    </div>
  `,
})
export class Shell {
  private readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  readonly userName    = computed(() => this.auth.user()?.name ?? '');
  readonly role        = computed(() => this.auth.role() ?? '');
  readonly userInitial = computed(() => this.userName().charAt(0).toUpperCase());

  readonly navItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [];

    if (this.auth.isInternal()) {
      items.push({ label: 'Tenants', path: '/tenants', icon: '🏢' });
    }

    if (!this.auth.isInternal()) {
      items.push(
        { label: 'Projects',  path: '/projects', icon: '📁' },
        { label: 'Billing',   path: '/billing',  icon: '💳' },
        { label: 'Audit log', path: '/audit',    icon: '📋' },
      );
    }

    if (this.auth.isOps()) {
      items.push({ label: 'Audit log', path: '/audit', icon: '📋' });
    }

    return items;
  });

  logout(): void {
    this.auth.logout();
  }
}
