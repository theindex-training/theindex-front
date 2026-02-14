import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

export type SettlementStatus = 'DRAFT' | 'FINAL';
export type AllocationReason = 'PUNCH_CREDIT' | 'TIME_PRORATA' | 'UNPAID';
export type SubscriptionType = 'PUNCH' | 'TIME' | null;

export interface Settlement {
  id: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  status: SettlementStatus;
  notes: string | null;
}

export interface SettlementLine {
  id: string;
  settlementId: string;
  trainerId: string;
  amountCents: number;
  attendanceCount: number;
  unpaidAttendanceCount: number;
  details: {
    punchCents: number;
    timeCents: number;
  };
}

export interface GenerateSettlementPayload {
  periodStart: string;
  periodEnd: string;
}

export interface GenerateSettlementResponse {
  settlement: Settlement;
  lines: SettlementLine[];
  info?: unknown;
}

export interface SettlementDetailsResponse {
  settlement: Settlement;
  lines: SettlementLine[];
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
  attendance?: SettlementAllocationAttendance;
}

export interface SettlementAllocationsResponse {
  total: number;
  limit: number;
  offset: number;
  rows: SettlementAllocation[];
}

@Injectable({
  providedIn: 'root'
})
export class SettlementsService {
  private readonly baseUrl = `${environment.apiUrl}/settlements`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<Settlement[]> {
    return this.http.get<Settlement[]>(this.baseUrl);
  }

  generate(payload: GenerateSettlementPayload): Observable<GenerateSettlementResponse> {
    return this.http.post<GenerateSettlementResponse>(this.baseUrl, payload);
  }

  getById(id: string): Observable<SettlementDetailsResponse> {
    return this.http.get<SettlementDetailsResponse>(`${this.baseUrl}/${id}`);
  }

  finalize(id: string): Observable<Settlement> {
    return this.http.post<Settlement>(`${this.baseUrl}/${id}/finalize`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  allocations(id: string, query: SettlementAllocationsQuery): Observable<SettlementAllocationsResponse> {
    const params = buildHttpParams({
      trainerId: query.trainerId,
      offset: query.offset,
      limit: query.limit
    });
    return this.http.get<SettlementAllocationsResponse>(`${this.baseUrl}/${id}/allocations`, { params });
  }
}
