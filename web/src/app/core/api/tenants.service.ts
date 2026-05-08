import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Tenant } from '../models/api.models';

export interface CreateTenantRequest {
  name: string;
  slug: string;
  email: string;
  logoUrl?: string;
}

export interface UpdateTenantRequest {
  name?: string;
  email?: string;
  logoUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class TenantsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tenants`;

  findAll() {
    return this.http.get<Tenant[]>(this.base);
  }

  findOne(id: string) {
    return this.http.get<Tenant>(`${this.base}/${id}`);
  }

  create(dto: CreateTenantRequest) {
    return this.http.post<Tenant>(this.base, dto);
  }

  update(id: string, dto: UpdateTenantRequest) {
    return this.http.patch<Tenant>(`${this.base}/${id}`, dto);
  }

  deactivate(id: string) {
    return this.http.patch<Tenant>(`${this.base}/${id}/deactivate`, {});
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
