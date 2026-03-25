import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

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

export interface CashRegisterState {
  balanceCents: number;
  transactions: CashRegisterTransaction[];
}

export interface CreateManualCashRegisterTransactionPayload {
  direction: CashRegisterDirection;
  amountCents: number;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CashRegisterService {
  private readonly baseUrl = `${environment.apiUrl}/cash-register`;

  constructor(private readonly http: HttpClient) {}

  getCurrentState(): Observable<CashRegisterState> {
    return this.http.get<CashRegisterState>(this.baseUrl);
  }

  createManualTransaction(
    payload: CreateManualCashRegisterTransactionPayload
  ): Observable<CashRegisterTransaction> {
    return this.http.post<CashRegisterTransaction>(`${this.baseUrl}/transactions/manual`, payload);
  }
}
