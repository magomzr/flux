import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthTokens, JwtPayload, LoginRequest, UserRole } from '../models/auth.models';

const ACCESS_TOKEN_KEY  = 'flux_access_token';
const REFRESH_TOKEN_KEY = 'flux_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  // ─── Estado ───────────────────────────────────────────────────────────────

  private readonly _payload = signal<JwtPayload | null>(this.loadPayload());

  readonly user        = computed(() => this._payload());
  readonly isLoggedIn  = computed(() => this._payload() !== null);
  readonly role        = computed(() => this._payload()?.role as UserRole | undefined);
  readonly tenantId    = computed(() => this._payload()?.tenantId ?? null);
  readonly permissions = computed(() => new Set(this._payload()?.permissions ?? []));

  readonly isSuperAdmin = computed(() => this.role() === 'super_admin');
  readonly isOps        = computed(() => this.role() === 'ops');
  readonly isInternal   = computed(() =>
    this.role() === 'super_admin' || this.role() === 'ops'
  );

  // ─── Auth ─────────────────────────────────────────────────────────────────

  login(credentials: LoginRequest) {
    return this.http
      .post<AuthTokens>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(tap((tokens) => this.storeTokens(tokens)));
  }

  refresh() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    return this.http
      .post<AuthTokens>(`${environment.apiUrl}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      .pipe(tap((tokens) => this.storeTokens(tokens)));
  }

  logout() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (refreshToken) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, { refresh_token: refreshToken })
        .subscribe({ error: () => {} }); // fire and forget
    }

    this.clearTokens();
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  hasPermission(permission: string): boolean {
    return this.permissions().has(permission);
  }

  // ─── Privados ─────────────────────────────────────────────────────────────

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    this._payload.set(this.decodeJwt(tokens.access_token));
  }

  private clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this._payload.set(null);
  }

  private loadPayload(): JwtPayload | null {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return null;

    const payload = this.decodeJwt(token);
    if (!payload) return null;

    // Verificar expiración
    if (Date.now() / 1000 > payload.exp) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      return null;
    }

    return payload;
  }

  private decodeJwt(token: string): JwtPayload | null {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64)) as JwtPayload;
    } catch {
      return null;
    }
  }
}
