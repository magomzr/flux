import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { SdkKey } from '../models/api.models';

export interface CreateSdkKeyRequest {
  name: string;
  expiresAt?: string;
}

@Injectable({ providedIn: 'root' })
export class SdkKeysService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  findAll(projectId: string, environmentId: string) {
    return this.http.get<SdkKey[]>(
      `${this.base}/projects/${projectId}/environments/${environmentId}/keys`,
    );
  }

  create(projectId: string, environmentId: string, dto: CreateSdkKeyRequest) {
    return this.http.post<SdkKey & { key: string }>(
      `${this.base}/projects/${projectId}/environments/${environmentId}/keys`,
      dto,
    );
  }

  revoke(projectId: string, environmentId: string, keyId: string) {
    return this.http.post<void>(
      `${this.base}/projects/${projectId}/environments/${environmentId}/keys/${keyId}/revoke`,
      {},
    );
  }

  remove(projectId: string, environmentId: string, keyId: string) {
    return this.http.delete<void>(
      `${this.base}/projects/${projectId}/environments/${environmentId}/keys/${keyId}`,
    );
  }
}
