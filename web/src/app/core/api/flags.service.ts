import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Flag, FlagValue } from '../models/api.models';

export interface CreateFlagRequest {
  key: string;
  name: string;
  description?: string;
  type?: 'boolean' | 'string' | 'number' | 'json';
}

export interface UpdateFlagValueRequest {
  enabled?: boolean;
  value?: string;
}

@Injectable({ providedIn: 'root' })
export class FlagsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  findAll(projectId: string) {
    return this.http.get<Flag[]>(`${this.base}/projects/${projectId}/flags`);
  }

  findOne(projectId: string, flagId: string) {
    return this.http.get<Flag>(`${this.base}/projects/${projectId}/flags/${flagId}`);
  }

  create(projectId: string, dto: CreateFlagRequest) {
    return this.http.post<Flag>(`${this.base}/projects/${projectId}/flags`, dto);
  }

  remove(projectId: string, flagId: string) {
    return this.http.delete<void>(`${this.base}/projects/${projectId}/flags/${flagId}`);
  }

  getFlagValue(projectId: string, flagId: string, environmentId: string) {
    return this.http.get<FlagValue>(
      `${this.base}/projects/${projectId}/flags/${flagId}/values/${environmentId}`,
    );
  }

  updateFlagValue(
    projectId: string,
    flagId: string,
    environmentId: string,
    dto: UpdateFlagValueRequest,
  ) {
    return this.http.patch<FlagValue>(
      `${this.base}/projects/${projectId}/flags/${flagId}/values/${environmentId}`,
      dto,
    );
  }

  publishFlagValue(projectId: string, flagId: string, environmentId: string) {
    return this.http.post<FlagValue>(
      `${this.base}/projects/${projectId}/flags/${flagId}/values/${environmentId}/publish`,
      {},
    );
  }
}
