import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable, tap } from 'rxjs';

interface LoginResponse {
  accessToken: string;
  account: unknown;
}

interface TokenPayload {
  sub?: string;
  email?: string;
  role?: string;
  trainerProfileId?: string | null;
  traineeProfileId?: string | null;
  /** The account must finish its first-login setup (`/account-setup`) before anything else. */
  setupRequired?: boolean;
  iat?: number;
  exp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly tokenKey = 'accessToken';

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
        email,
        password,
      })
      .pipe(tap((response) => this.setToken(response.accessToken)));
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUserRole(): string | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    return this.decodeToken(token)?.role ?? null;
  }

  getUserEmail(): string | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    const payload = this.decodeToken(token);

    return payload?.email ?? payload?.sub ?? null;
  }

  getAccountId(): string | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    return this.decodeToken(token)?.sub ?? null;
  }

  getTrainerProfileId(): string | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    return this.decodeToken(token)?.trainerProfileId ?? null;
  }

  getTraineeProfileId(): string | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    return this.decodeToken(token)?.traineeProfileId ?? null;
  }

  /**
   * Whether the signed-in account still has to go through the first-login setup: an account an
   * admin created (their password is still the admin's), or one that never gave consent.
   */
  isSetupRequired(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    return this.decodeToken(token)?.setupRequired === true;
  }

  /** Signs in with a token the API answered outside the login (the finished account setup). */
  useToken(token: string): void {
    this.setToken(token);
  }

  /** Where a signed-in person starts: trainees on their profile, staff on the dashboard. */
  defaultRoute(): string {
    return this.getUserRole() === 'TRAINEE' ? '/my-profile' : '/home';
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private decodeToken(token: string): TokenPayload | null {
    try {
      const payload = token.split('.')[1];

      if (!payload) {
        return null;
      }

      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const decoded = atob(padded);

      return JSON.parse(decoded) as TokenPayload;
    } catch {
      return null;
    }
  }
}
