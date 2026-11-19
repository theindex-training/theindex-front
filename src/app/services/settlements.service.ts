import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

export type SettlementStatus = 'DRAFT' | 'FINAL';
export type AllocationReason = 'PUNCH_CREDIT' | 'TIME_PRORATA' | 'UNPAID';
export type SubscriptionType = 'PUNCH' | 'TIME' | null;

/**
 * A settlement report. The API creates one per half month (1st–15th, 16th–end) once the period is
 * over; staff review it and an admin finalizes it, oldest first. Nobody creates or deletes one.
 */
export interface Settlement {
  id: string;
  periodStart: string;
  periodEnd: string;
  /** When the API created the report. */
  generatedAt: string;
  status: SettlementStatus;
  /** When it was finalized (paid out); null while a draft. */
  finalizedAt: string | null;
  notes: string | null;
}

/** One trainer's part of a report (a draft's is worked out when it is read). */
export interface SettlementLine {
  trainerId: string;
  /** What the report pays the trainer. */
  amountCents: number;
  /** Trainings it pays them for. */
  attendanceCount: number;
  punchCents: number;
  timeCents: number;
  /** The part carried over from earlier periods (paid once their value became known). */
  earlierPeriodsCents: number;
  earlierPeriodsCount: number;
  /** Their trainings of the period that a later report pays. */
  waitingCount: number;
}

/**
 * Why a training of the period isn't paid by its report: no subscription pays it yet, its TIME
 * pass ends after the period (`availableFrom`), or its value became known after the period.
 */
export type WaitingReason = 'UNPAID' | 'TIME_PASS_NOT_ENDED' | 'NEXT_REPORT';

export interface SettlementWaiting {
  attendanceId: string;
  trainerId: string;
  traineeId: string;
  locationId: string | null;
  trainedAt: string;
  reason: WaitingReason;
  subscriptionType: SubscriptionType;
  availableFrom: string | null;
}

export interface SettlementDetailsResponse {
  settlement: Settlement;
  lines: SettlementLine[];
  waiting: SettlementWaiting[];
}

export interface SettlementAllocationsQuery {
  trainerId?: string;
  offset?: number;
  limit?: number;
}

export interface SettlementAllocationAttendance {
  id: string;
  trainedAt: string;
  paymentStatus: 'PAID' | 'UNPAID';
  trainerId: string;
  traineeId: string;
  subscriptionId: string | null;
  locationId?: string | null;
}

export interface SettlementAllocation {
  id: string;
  settlementId: string;
  attendanceId: string;
  trainerId: string;
  subscriptionId: string | null;
  subscriptionType: SubscriptionType;
  valueCents: number;
  reason: AllocationReason;
  /** Trained before the report's period: carried over from an earlier period. */
  fromEarlierPeriod: boolean;
  attendance?: SettlementAllocationAttendance;
}

export interface SettlementAllocationsResponse {
  total: number;
  limit: number;
  offset: number;
  rows: SettlementAllocation[];
}

@Injectable({
  providedIn: 'root',
})
export class SettlementsService {
  private readonly baseUrl = `${environment.apiUrl}/settlements`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<Settlement[]> {
    return this.http.get<Settlement[]>(this.baseUrl);
  }

  getById(id: string): Observable<SettlementDetailsResponse> {
    return this.http.get<SettlementDetailsResponse>(`${this.baseUrl}/${id}`);
  }

  finalize(id: string): Observable<Settlement> {
    return this.http.post<Settlement>(`${this.baseUrl}/${id}/finalize`, {});
  }

  allocations(
    id: string,
    query: SettlementAllocationsQuery,
  ): Observable<SettlementAllocationsResponse> {
    const params = buildHttpParams({
      trainerId: query.trainerId,
      offset: query.offset,
      limit: query.limit,
    });
    return this.http.get<SettlementAllocationsResponse>(
      `${this.baseUrl}/${id}/allocations`,
      { params },
    );
  }
}
