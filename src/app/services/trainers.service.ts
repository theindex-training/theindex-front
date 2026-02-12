import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

export interface TrainerProfile {
  id: string;
  name: string;
  nickname: string | null;
  accountId: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface CreateTrainerPayload {
  name: string;
  nickname?: string | null;
  isActive?: boolean;
}

export interface UpdateTrainerPayload {
  name?: string;
  nickname?: string | null;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TrainersService {
  private readonly baseUrl = `${environment.apiUrl}/trainers`;

  constructor(private readonly http: HttpClient) {}

  list(active?: boolean): Observable<TrainerProfile[]> {
    const params = buildHttpParams({ active });
    return this.http.get<TrainerProfile[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<TrainerProfile> {
    return this.http.get<TrainerProfile>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateTrainerPayload): Observable<TrainerProfile> {
    return this.http.post<TrainerProfile>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateTrainerPayload): Observable<TrainerProfile> {
    return this.http.patch<TrainerProfile>(`${this.baseUrl}/${id}`, payload);
  }

  deactivate(id: string): Observable<TrainerProfile> {
    return this.http.delete<TrainerProfile>(`${this.baseUrl}/${id}`);
  }
}
