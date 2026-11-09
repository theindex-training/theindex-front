import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

/**
 * One trainee on the renewals page (theindex-api `RenewalRow`). Which fields
 * are set depends on the tab and section:
 * - PUNCH active: `remainingCredits`, summed over the active subscriptions.
 * - PUNCH exhausted: `unpaidTrainings`, trained past the last subscription.
 * - TIME active: `endsAt` (latest end of the active ones) and `daysLeft`.
 * - TIME exhausted: `endsAt` (when the last one ended) and `daysSinceEnd`.
 * Days are Europe/Sofia calendar days (0 = today).
 */
export interface RenewalRow {
  traineeId: string;
  name: string;
  nickname: string | null;
  /** Plan of the trainee's latest subscription of this type. */
  planTitle: string;
  /** Subscriptions of this type still running (0 when exhausted). */
  activeSubscriptions: number;
  remainingCredits: number | null;
  endsAt: string | null;
  daysLeft: number | null;
  daysSinceEnd: number | null;
  unpaidTrainings: number;
  lastTrainedAt: string | null;
}

export interface RenewalSections {
  /** Nothing left: most unpaid trainings (punch) or longest ended (time) first. */
  exhausted: RenewalRow[];
  /** Still paid: fewest trainings or days left first. */
  active: RenewalRow[];
}

/** Every active trainee with a subscription, each in one tab, already sorted by the API. */
export interface SubscriptionRenewals {
  punch: RenewalSections;
  time: RenewalSections;
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionRenewalsService {
  private readonly baseUrl = `${environment.apiUrl}/subscription-renewals`;

  constructor(private readonly http: HttpClient) {}

  overview(): Observable<SubscriptionRenewals> {
    return this.http.get<SubscriptionRenewals>(this.baseUrl);
  }
}
