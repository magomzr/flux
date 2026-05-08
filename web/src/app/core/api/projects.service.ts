import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Project } from '../models/api.models';

export interface CreateProjectRequest {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  findAll(tenantId: string) {
    return this.http.get<Project[]>(`${this.base}/tenants/${tenantId}/projects`);
  }

  findOne(tenantId: string, projectId: string) {
    return this.http.get<Project>(`${this.base}/tenants/${tenantId}/projects/${projectId}`);
  }

  create(tenantId: string, dto: CreateProjectRequest) {
    return this.http.post<Project>(`${this.base}/tenants/${tenantId}/projects`, dto);
  }

  update(tenantId: string, projectId: string, dto: UpdateProjectRequest) {
    return this.http.patch<Project>(`${this.base}/tenants/${tenantId}/projects/${projectId}`, dto);
  }

  deactivate(tenantId: string, projectId: string) {
    return this.http.patch<Project>(
      `${this.base}/tenants/${tenantId}/projects/${projectId}/deactivate`, {},
    );
  }

  remove(tenantId: string, projectId: string) {
    return this.http.delete<void>(`${this.base}/tenants/${tenantId}/projects/${projectId}`);
  }
}
