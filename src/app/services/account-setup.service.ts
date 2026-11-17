import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * The first-login form's starting point (theindex-api `GET /api/account-setup`): what an admin
 * entered for the person. Never the nickname: it is internal to staff.
 */
export interface AccountSetup {
  profileType: 'trainee' | 'trainer';
  /** False once done: the page then sends the person on. */
  setupRequired: boolean;
  /** Whether a new password is asked for (the admin's one is still in place). */
  passwordChangeRequired: boolean;
  email: string | null;
  name: string;
  phone: string | null;
  /** Always null for trainers. */
  gymSubscriptionId: string | null;
  /** A trainee's preferred gym or a trainer's primary gym. */
  homeGymId: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
}

/** `POST /api/account-setup`: the register form's fields. */
export interface CompleteAccountSetupPayload {
  email: string;
  name: string;
  /** Only while `passwordChangeRequired`. */
  password?: string;
  confirmPassword?: string;
  phone: string;
  /** Trainees only. */
  gymSubscriptionId?: string | null;
  homeGymId: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  acceptTerms: boolean;
}

interface CompleteAccountSetupResponse {
  accessToken: string;
  account: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AccountSetupService {
  private readonly baseUrl = `${environment.apiUrl}/account-setup`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
  ) {}

  get(): Observable<AccountSetup> {
    return this.http.get<AccountSetup>(this.baseUrl);
  }

  /** Saves the form; the answer's token (no longer requiring the setup) replaces the stored one. */
  complete(
    payload: CompleteAccountSetupPayload,
  ): Observable<CompleteAccountSetupResponse> {
    return this.http
      .post<CompleteAccountSetupResponse>(this.baseUrl, payload)
      .pipe(tap((response) => this.authService.useToken(response.accessToken)));
  }
}
