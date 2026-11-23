import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

export type CashRegisterDirection = 'IN' | 'OUT';

export interface CashRegisterTransaction {
  id: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  sourceType: string;
  sourceId: string | null;
  notes: string | null;
  createdAt: string;
  sourceDetails: CashRegisterTransactionSourceDetails | null;
  updatedAt?: string;
}

export interface CashRegisterTransactionSourceDetails {
  periodStart?: string;
  periodEnd?: string;
  boughtBy?: {
    traineeId: string;
    name: string;
    nickname: string | null;
  };
  purchasedAt?: string;
  subscriptionType?: string;
  planTitle?: string;
}

/** The page of transactions to ask for, newest first (the API gives 50 by default, up to 500). */
export interface CashRegisterQuery {
  offset?: number;
  limit?: number;
}

/** The balance and one page of the transactions, newest first; `total` counts them all. */
export interface CashRegisterState {
  balanceCents: number;
  total: number;
  limit: number;
  offset: number;
  transactions: CashRegisterTransaction[];
}

export interface CreateManualCashRegisterTransactionPayload {
  direction: CashRegisterDirection;
  amountCents: number;
  notes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CashRegisterService {
  private readonly baseUrl = `${environment.apiUrl}/cash-register`;

  constructor(private readonly http: HttpClient) {}

  getCurrentState(
    query: CashRegisterQuery = {},
  ): Observable<CashRegisterState> {
    const params = buildHttpParams({
      offset: query.offset,
      limit: query.limit,
    });
    return this.http.get<CashRegisterState>(this.baseUrl, { params });
  }

  createManualTransaction(
    payload: CreateManualCashRegisterTransactionPayload,
  ): Observable<CashRegisterTransaction> {
    return this.http.post<CashRegisterTransaction>(
      `${this.baseUrl}/transactions/manual`,
      payload,
    );
  }
}
