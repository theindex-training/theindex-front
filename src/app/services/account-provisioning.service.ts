import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export type AccountRole = 'ADMIN' | 'TRAINER' | 'TRAINEE';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export interface ProvisionAccountPayload {
  email: string;
  role: AccountRole;
  status: AccountStatus;
  password: string;
  confirmPassword: string;
}

export interface ProvisionedAccount {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccountProvisioningService {
  private readonly baseUrl = `${environment.apiUrl}/accounts/provision`;

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
}
