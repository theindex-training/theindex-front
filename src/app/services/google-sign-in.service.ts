import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable, Subject, map } from 'rxjs';

/** Google Identity Services' script ("Sign in with Google"). */
export const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

/** What the sign-in callback gets: `credential` is a Google ID token for the API to check. */
export interface GoogleCredentialResponse {
  credential: string;
}

/** Options of `renderButton` this app uses (Google Identity Services' button). */
export interface GoogleButtonOptions {
  type: 'standard';
  theme: 'outline' | 'filled_black';
  size: 'large';
  text: 'signin_with';
  shape: 'rectangular';
  logo_alignment: 'left';
  width: number;
  locale: string;
}

/** The part of `google.accounts.id` this app uses. */
export interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode: 'popup';
    auto_select: false;
    context: 'signin';
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
}

type GoogleWindow = Window & {
  google?: { accounts?: { id?: GoogleAccountsId } };
};

/**
 * "Sign in with Google" (theindex-api `POST /api/auth/google`): a shortcut into the account whose
 * email is the Google account's (Gmail or Google Workspace), never a new account.
 *
 * The client id comes from the API (`GET /api/auth/google/config`, null while the API has no
 * `GOOGLE_CLIENT_ID`: then the login page shows no button). Google's script is loaded only then,
 * once, and initialized once per client id; every sign-in's credential comes out of `credential$`.
 * No One Tap prompt: only the button signs in.
 */
@Injectable({ providedIn: 'root' })
export class GoogleSignInService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly credentials = new Subject<string>();
  private sdk: Promise<GoogleAccountsId> | null = null;
  private initializedFor: string | null = null;

  /** The ID token of each completed Google sign-in. */
  readonly credential$ = this.credentials.asObservable();

  /** The OAuth client id of Google sign-in, or null when the API hasn't got one. */
  clientId(): Observable<string | null> {
    return this.http
      .get<{
        clientId: string | null;
      }>(`${environment.apiUrl}/auth/google/config`)
      .pipe(map((config) => config.clientId?.trim() || null));
  }

  /** Google Identity Services, loaded and initialized for `clientId`. Rejects if it can't load. */
  async load(clientId: string): Promise<GoogleAccountsId> {
    const id = await this.loadScript();
    if (this.initializedFor !== clientId) {
      id.initialize({
        client_id: clientId,
        callback: ({ credential }) => this.credentials.next(credential),
        ux_mode: 'popup',
        auto_select: false,
        context: 'signin',
      });
      this.initializedFor = clientId;
    }
    return id;
  }

  private loadScript(): Promise<GoogleAccountsId> {
    const loaded = this.googleId();
    if (loaded) return Promise.resolve(loaded);

    this.sdk ??= new Promise<GoogleAccountsId>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.onload = () => {
        const id = this.googleId();
        if (id) resolve(id);
        else reject(new Error('Google Identity Services did not load'));
      };
      script.onerror = () =>
        reject(new Error('Google Identity Services did not load'));
      this.document.head.appendChild(script);
    }).catch((error: unknown) => {
      // Blocked or offline: the next visit to the login page tries again.
      this.sdk = null;
      throw error;
    });
    return this.sdk;
  }

  private googleId(): GoogleAccountsId | undefined {
    return (this.document.defaultView as GoogleWindow | null)?.google?.accounts
      ?.id;
  }
}
