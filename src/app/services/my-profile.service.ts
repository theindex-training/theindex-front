import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class MyProfileService {
  private readonly baseUrl = `${environment.apiUrl}/my-profile`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<MyProfile> {
    return this.http.get<MyProfile>(this.baseUrl);
  }

  update(payload: UpdateMyProfilePayload): Observable<MyProfile> {
    return this.http.patch<MyProfile>(this.baseUrl, payload);
  }
}
