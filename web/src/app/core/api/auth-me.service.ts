import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AuthMeService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  changePassword(dto: ChangePasswordRequest) {
    return this.http.patch<void>(`${this.base}/users/me/password`, dto);
  }
}
