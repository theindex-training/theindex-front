import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { map, Observable } from 'rxjs';

interface PasswordStatusResponse {
  hasChangedPassword?: boolean;
  isChanged?: boolean;
  passwordChanged?: boolean;
}

interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccountSecurityService {
  private readonly baseUrl = `${environment.apiUrl}/accounts`;

  constructor(private readonly http: HttpClient) {}

  hasChangedPassword(accountId: string): Observable<boolean> {
    return this.http
      .get<boolean | PasswordStatusResponse>(`${this.baseUrl}/${accountId}/password-status`)
      .pipe(
        map(response => {
          if (typeof response === 'boolean') {
            return response;
          }

          return Boolean(
            response.hasChangedPassword ?? response.isChanged ?? response.passwordChanged
          );
        })
      );
  }

  changePassword(accountId: string, payload: ChangePasswordPayload): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${accountId}/password`, payload);
  }
}
