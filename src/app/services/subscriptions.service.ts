import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export type SubscriptionType = 'PUNCH' | 'TIME';

export interface Subscription {
  id: string;
  traineeId: string;
  planId: string;
  type: SubscriptionType;
  status: string;
  paidCents: number;
  startsAt: string;
  endsAt: string | null;
  initialCredits: number | null;
  remainingCredits: number | null;
  createdAt?: string;
}

export interface CreateSubscriptionPayload {
  planId: string;
  startsAt?: string;
  paidCents?: number;
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionsService {
  private readonly baseUrl = `${environment.apiUrl}/trainees`;
  private readonly subscriptionsUrl = `${environment.apiUrl}/subscriptions`;

  constructor(private readonly http: HttpClient) {}

  listForTrainee(traineeId: string): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.baseUrl}/${traineeId}/subscriptions`);
  }

  createForTrainee(
    traineeId: string,
    payload: CreateSubscriptionPayload,
  ): Observable<Subscription> {
    return this.http.post<Subscription>(`${this.baseUrl}/${traineeId}/subscriptions`, payload);
  }

  delete(subscriptionId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.subscriptionsUrl}/${subscriptionId}`);
  }
}
