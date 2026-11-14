import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { ProvisionedAccount } from './account-provisioning.service';

export interface NamedOption {
  id: string;
  name: string;
}

/** The active gyms and gym subscriptions people can pick (public). */
export interface RegistrationOptions {
  gyms: NamedOption[];
  gymSubscriptions: NamedOption[];
}

export interface RegisterPayload {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone: string;
  gymSubscriptionId?: string | null;
  preferredGymId?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  /** The person agrees to the use of their personal data and to receiving emails. */
  acceptTerms: boolean;
}

/** Self-registration (theindex-api `POST /api/auth/register`, public). */
@Injectable({
  providedIn: 'root',
})
export class RegistrationService {
  private readonly baseUrl = `${environment.apiUrl}/auth/register`;

  constructor(private readonly http: HttpClient) {}

  /** Creates the account; it can log in once an admin connects it to a profile. */
  register(payload: RegisterPayload): Observable<ProvisionedAccount> {
    return this.http.post<ProvisionedAccount>(this.baseUrl, payload);
  }

  options(): Observable<RegistrationOptions> {
    return this.http.get<RegistrationOptions>(`${this.baseUrl}/options`);
  }
}
