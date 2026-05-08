export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface JwtPayload {
  sub: string;
  name: string;
  tenantId: string | null;
  role: string;
  permissions: string[];
  exp: number;
}

export type UserRole =
  | 'super_admin'
  | 'ops'
  | 'tenant_admin'
  | 'developer'
  | 'editor'
  | 'viewer';
