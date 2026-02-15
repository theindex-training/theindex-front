import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export type AccountRole = 'ADMIN' | 'TRAINER' | 'TRAINEE';
export type AccountStatus = 'ACTIVE' | 'DISABLED';

export interface ProvisionAccountPayload {
  email: string;
  role: AccountRole;
  password: string;
  confirmPassword: string;
}

export interface UpdateAccountPayload {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export interface ProvisionedAccount {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  trainerProfileId?: string | null;
  traineeProfileId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccountProvisioningService {
  private readonly baseUrl = `${environment.apiUrl}/accounts`;

  constructor(private readonly http: HttpClient) {}

  provisionForProfile(
    profileType: 'trainer' | 'trainee',
    profileId: string,
    payload: ProvisionAccountPayload
  ): Observable<ProvisionedAccount> {
    return this.http.post<ProvisionedAccount>(
      `${this.baseUrl}/${profileType}/${profileId}`,
      payload
    );
  }

  getById(accountId: string): Observable<ProvisionedAccount | null> {
    return this.http.get<ProvisionedAccount | null>(`${this.baseUrl}/${accountId}`);
  }

  update(accountId: string, payload: UpdateAccountPayload): Observable<ProvisionedAccount> {
    return this.http.patch<ProvisionedAccount>(`${this.baseUrl}/${accountId}`, payload);
  }

  deactivate(accountId: string): Observable<ProvisionedAccount> {
    return this.http.delete<ProvisionedAccount>(`${this.baseUrl}/${accountId}`);
  }
}
