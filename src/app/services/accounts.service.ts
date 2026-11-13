import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';
import { AccountRole, AccountStatus } from './account-provisioning.service';
import { NamedOption } from './registration.service';

export type AccountLinkFilter = 'unlinked' | 'linked' | 'all';
export type ProfileType = 'trainee' | 'trainer';

/** An account as the admin's Accounts page shows it (theindex-api `accounts/account-view.ts`). */
export interface AccountView {
  id: string;
  email: string | null;
  role: AccountRole;
  status: AccountStatus;
  createdAt: string;
  /** When the person agreed to the use of their data and to emails; null if never asked. */
  consentAt: string | null;
  /** What the person entered when they registered; null for accounts an admin created. */
  registration: {
    name: string;
    phone: string;
    gymSubscription: NamedOption | null;
    preferredGym: NamedOption | null;
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
  } | null;
  /** The profile the account is connected to, or null. */
  profile: {
    type: ProfileType;
    id: string;
    name: string;
    nickname: string | null;
    isActive: boolean;
  } | null;
}

/** What the connected profile stores, as the admin decided. */
export interface LinkAccountPayload {
  profileType: ProfileType;
  /** An existing active profile without an account; left out to create a new one. */
  profileId?: string;
  name: string;
  nickname?: string | null;
  phone?: string | null;
  /** Trainees only. */
  gymSubscriptionId?: string | null;
  /** The trainee's preferred gym or the trainer's primary gym. */
  homeGymId?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
}

/** The admin's Accounts page (theindex-api `/api/accounts`, ADMIN only). */
@Injectable({
  providedIn: 'root',
})
export class AccountsService {
  private readonly baseUrl = `${environment.apiUrl}/accounts`;

  constructor(private readonly http: HttpClient) {}

  list(link: AccountLinkFilter, search?: string): Observable<AccountView[]> {
    return this.http.get<AccountView[]>(this.baseUrl, {
      params: buildHttpParams({ link, search }),
    });
  }

  details(id: string): Observable<AccountView> {
    return this.http.get<AccountView>(`${this.baseUrl}/${id}/details`);
  }

  link(id: string, payload: LinkAccountPayload): Observable<AccountView> {
    return this.http.post<AccountView>(`${this.baseUrl}/${id}/link`, payload);
  }

  /** Only for an account that isn't connected to a profile. */
  deletePermanently(id: string): Observable<{ id: string; deleted: true }> {
    return this.http.delete<{ id: string; deleted: true }>(
      `${this.baseUrl}/${id}/permanent`,
    );
  }
}
