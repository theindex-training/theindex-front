import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

export interface GymSubscription {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
}

export interface CreateGymSubscriptionPayload {
  name: string;
}

export interface UpdateGymSubscriptionPayload {
  name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GymSubscriptionsService {
  private readonly baseUrl = `${environment.apiUrl}/gym-subscriptions`;

  constructor(private readonly http: HttpClient) {}

  list(includeInactive?: boolean): Observable<GymSubscription[]> {
    const params = buildHttpParams({ includeInactive });
    return this.http.get<GymSubscription[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<GymSubscription> {
    return this.http.get<GymSubscription>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateGymSubscriptionPayload): Observable<GymSubscription> {
    return this.http.post<GymSubscription>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateGymSubscriptionPayload): Observable<GymSubscription> {
    return this.http.patch<GymSubscription>(`${this.baseUrl}/${id}`, payload);
  }

  deactivate(id: string): Observable<GymSubscription> {
    return this.http.delete<GymSubscription>(`${this.baseUrl}/${id}`);
  }
}
