import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export type PlanType = 'PUNCH' | 'TIME';

export interface Plan {
  id: string;
  type: PlanType;
  title: string;
  priceCents: number;
  credits: number | null;
  durationDays: number | null;
  isActive: boolean;
  createdAt?: string;
}

export interface CreatePlanPayload {
  type: PlanType;
  title: string;
  priceCents: number;
  credits?: number;
  durationDays?: number;
  isActive?: boolean;
}

export interface UpdatePlanPayload {
  type?: PlanType;
  title?: string;
  priceCents?: number;
  credits?: number | null;
  durationDays?: number | null;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PlansService {
  private readonly baseUrl = `${environment.apiUrl}/plans`;

  constructor(private readonly http: HttpClient) {}

  list(active?: boolean): Observable<Plan[]> {
    let params = new HttpParams();
    if (active !== undefined) {
      params = params.set('active', String(active));
    }
    return this.http.get<Plan[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<Plan> {
    return this.http.get<Plan>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreatePlanPayload): Observable<Plan> {
    return this.http.post<Plan>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdatePlanPayload): Observable<Plan> {
    return this.http.patch<Plan>(`${this.baseUrl}/${id}`, payload);
  }
}
