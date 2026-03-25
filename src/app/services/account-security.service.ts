import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { map, Observable } from 'rxjs';

interface PasswordStatusResponse {
  accountId: string;
  hasUpdatedInitialPassword: boolean;
}

interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
  phone?: string | null;
}

interface ChangePasswordResponse {
  accountId: string;
  hasUpdatedInitialPassword: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AccountSecurityService {
  private readonly baseUrl = `${environment.apiUrl}/accounts`;

  constructor(private readonly http: HttpClient) {}

  hasChangedPassword(accountId: string): Observable<boolean> {
    return this.http
      .get<PasswordStatusResponse>(`${this.baseUrl}/${accountId}/password-status`)
      .pipe(map(response => response.hasUpdatedInitialPassword));
  }

  changePassword(
    accountId: string,
    payload: ChangePasswordPayload
  ): Observable<ChangePasswordResponse> {
    return this.http.post<ChangePasswordResponse>(`${this.baseUrl}/${accountId}/change-password`, payload);
  }
}
