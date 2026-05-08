import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center px-4"
         style="background-color: var(--bg-base)">
      <div class="w-full max-w-sm">

        <!-- Logo / marca -->
        <div class="mb-8 text-center">
          <span class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary)">flux</span>
          <p class="mt-1 text-sm" style="color: var(--text-muted)">Feature flags for your products</p>
        </div>

        <!-- Card -->
        <div class="rounded-xl p-6 border"
             style="background-color: var(--bg-surface); border-color: var(--border)">
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">

            <div class="space-y-1">
              <label class="text-xs font-medium uppercase tracking-wider"
                     style="color: var(--text-muted)">
                Email
              </label>
              <input
                type="email"
                formControlName="email"
                autocomplete="email"
                placeholder="you@company.com"
                class="w-full rounded-lg px-3 py-2 text-sm border transition-colors
                       focus:outline-none focus:ring-2"
                style="background-color: var(--input-bg); border-color: var(--input-border);
                       color: var(--text-primary); --tw-ring-color: var(--input-focus)"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium uppercase tracking-wider"
                     style="color: var(--text-muted)">
                Password
              </label>
              <input
                type="password"
                formControlName="password"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full rounded-lg px-3 py-2 text-sm border transition-colors
                       focus:outline-none focus:ring-2"
                style="background-color: var(--input-bg); border-color: var(--input-border);
                       color: var(--text-primary); --tw-ring-color: var(--input-focus)"
              />
            </div>

            @if (error()) {
              <p class="text-xs rounded-lg px-3 py-2 border"
                 style="color: var(--danger); background-color: var(--danger-subtle); border-color: var(--danger)">
                {{ error() }}
              </p>
            }

            <button
              type="submit"
              [disabled]="loading() || form.invalid"
              class="w-full text-white text-sm font-medium rounded-lg px-4 py-2.5
                     transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style="background-color: var(--accent)"
            >
              @if (loading()) { Signing in... } @else { Sign in }
            </button>

          </form>
        </div>

      </div>
    </div>
  `,
})
export class Login {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb     = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(
          err.status === 401
            ? 'Invalid email or password'
            : 'Something went wrong. Try again.',
        );
        this.loading.set(false);
      },
    });
  }
}
