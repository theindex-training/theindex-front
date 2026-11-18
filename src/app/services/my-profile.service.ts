import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * The square chosen on a profile photo's picture (theindex-api `PhotoCropDto`): fractions (0–1)
 * of the picture after turning it `rotation` degrees clockwise. The API cuts it from the picture.
 */
export interface PhotoCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: PhotoRotation;
}

export type PhotoRotation = 0 | 90 | 180 | 270;

/** A profile photo (theindex-api `/api/my-profile/photo`). */
export interface ProfilePhoto {
  /** 512 × 512 px. */
  url: string;
  /** 128 × 128 px, for small avatars. */
  thumbnailUrl: string;
  crop: PhotoCrop;
  updatedAt: string;
}

/**
 * A trainee's or trainer's own details (theindex-api `/api/my-profile`). Never the nickname:
 * it is internal to staff.
 */
export interface MyProfile {
  profileType: 'trainee' | 'trainer';
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
  consentAt: string | null;
  /** Their profile photo, or null. */
  photo: ProfilePhoto | null;
}

export interface UpdateMyProfilePayload {
  phone?: string;
  /** Trainees only. */
  gymSubscriptionId?: string | null;
  homeGymId?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
}

/**
 * "My details" of trainees and trainers, plus the signed-in person's own profile as a signal
 * (`current`), which the navigation's user block shows (name initials, photo). Every answer of
 * this service updates it, so a new photo shows there at once.
 */
@Injectable({
  providedIn: 'root',
})
export class MyProfileService {
  private readonly baseUrl = `${environment.apiUrl}/my-profile`;
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly profile = signal<MyProfile | null>(null);
  /** The signed-in person's profile, once loaded (`loadCurrent()` or any call here). */
  readonly current = this.profile.asReadonly();
  /** The account `current` belongs to (a sign-in as someone else starts over). */
  private loadedFor: string | null = null;
  /** The account whose `loadCurrent()` request is on its way, if any. */
  private loadingFor: string | null = null;

  get(): Observable<MyProfile> {
    const account = this.auth.getAccountId();
    return this.http
      .get<MyProfile>(this.baseUrl)
      .pipe(tap((profile) => this.remember(profile, account)));
  }

  update(payload: UpdateMyProfilePayload): Observable<MyProfile> {
    const account = this.auth.getAccountId();
    return this.http
      .patch<MyProfile>(this.baseUrl, payload)
      .pipe(tap((profile) => this.remember(profile, account)));
  }

  /**
   * Loads `current` once per signed-in account (trainees and trainers only: admins have no
   * profile). A failure leaves it empty; the user block then shows what the token has.
   */
  loadCurrent(): void {
    if (this.auth.getAccountId() !== this.loadedFor) {
      this.profile.set(null);
      this.loadedFor = null;
    }
    const role = this.auth.getUserRole();
    if (role !== 'TRAINEE' && role !== 'TRAINER') return;
    const account = this.auth.getAccountId();
    if (this.loadedFor || this.loadingFor === account) return;
    this.loadingFor = account;
    const done = () => {
      if (this.loadingFor === account) this.loadingFor = null;
    };
    this.get().subscribe({ next: done, error: done });
  }

  /** Sets a new photo: the picture (JPEG, PNG or WebP) and the square chosen on it. */
  uploadPhoto(file: Blob, crop: PhotoCrop): Observable<ProfilePhoto> {
    const account = this.auth.getAccountId();
    const body = new FormData();
    body.append('file', file);
    for (const [field, value] of Object.entries(crop)) {
      body.append(field, String(value));
    }
    return this.http
      .put<ProfilePhoto>(`${this.baseUrl}/photo`, body)
      .pipe(tap((photo) => this.rememberPhoto(photo, account)));
  }

  /** Crops the kept picture again. */
  recropPhoto(crop: PhotoCrop): Observable<ProfilePhoto> {
    const account = this.auth.getAccountId();
    return this.http
      .patch<ProfilePhoto>(`${this.baseUrl}/photo`, crop)
      .pipe(tap((photo) => this.rememberPhoto(photo, account)));
  }

  /** The picture the photo was cropped from (private: fetched with the token). */
  photoOriginal(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/photo/original`, {
      responseType: 'blob',
    });
  }

  removePhoto(): Observable<void> {
    const account = this.auth.getAccountId();
    return this.http
      .delete<void>(`${this.baseUrl}/photo`)
      .pipe(tap(() => this.rememberPhoto(null, account)));
  }

  /**
   * Keeps an answer as `current` only if it was asked for by the account still signed in: a
   * sign-out and another sign-in while it was on its way must not show someone else's profile.
   */
  private remember(profile: MyProfile, account: string | null): void {
    if (account !== this.auth.getAccountId()) return;
    this.loadedFor = account;
    this.profile.set(profile);
  }

  private rememberPhoto(
    photo: ProfilePhoto | null,
    account: string | null,
  ): void {
    const profile = this.profile();
    if (profile && account === this.loadedFor) {
      this.profile.set({ ...profile, photo });
    }
  }
}
