import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface TenantUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface UpdateUserRequest {
  name?: string;
  role?: string;
  isActive?: boolean;
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  findAll(tenantId: string) {
    return this.http.get<TenantUser[]>(`${this.base}/tenants/${tenantId}/users`);
  }

  create(tenantId: string, dto: CreateUserRequest) {
    return this.http.post<TenantUser>(`${this.base}/tenants/${tenantId}/users`, dto);
  }

  update(tenantId: string, userId: string, dto: UpdateUserRequest) {
    return this.http.patch<TenantUser>(
      `${this.base}/tenants/${tenantId}/users/${userId}`,
      dto,
    );
  }

  remove(tenantId: string, userId: string) {
    return this.http.delete<void>(`${this.base}/tenants/${tenantId}/users/${userId}`);
  }
}
