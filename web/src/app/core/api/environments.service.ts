import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Environment } from '../models/api.models';

export interface CreateEnvironmentRequest {
  name: string;
  slug: string;
  color?: string;
  isDefault?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EnvironmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  findAll(projectId: string) {
    return this.http.get<Environment[]>(`${this.base}/projects/${projectId}/environments`);
  }

  create(projectId: string, dto: CreateEnvironmentRequest) {
    return this.http.post<Environment>(`${this.base}/projects/${projectId}/environments`, dto);
  }

  remove(projectId: string, environmentId: string) {
    return this.http.delete<void>(
      `${this.base}/projects/${projectId}/environments/${environmentId}`,
    );
  }
}
