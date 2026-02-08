import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable, tap } from 'rxjs';

interface LoginResponse {
  accessToken: string;
  account: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenKey = 'accessToken';

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
        email,
        password
      })
      .pipe(tap(response => this.setToken(response.accessToken)));
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

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }
}
