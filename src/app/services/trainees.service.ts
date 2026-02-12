import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

export interface TraineeProfile {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  accountId: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface CreateTraineePayload {
  name: string;
  nickname?: string | null;
  phone?: string | null;
  isActive?: boolean;
}

export interface UpdateTraineePayload {
  name?: string;
  nickname?: string | null;
  phone?: string | null;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TraineesService {
  private readonly baseUrl = `${environment.apiUrl}/trainees`;

  constructor(private readonly http: HttpClient) {}

  list(active?: boolean, search?: string): Observable<TraineeProfile[]> {
    const params = buildHttpParams({
      active,
      search
    });

    return this.http.get<TraineeProfile[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<TraineeProfile> {
    return this.http.get<TraineeProfile>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateTraineePayload): Observable<TraineeProfile> {
    return this.http.post<TraineeProfile>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateTraineePayload): Observable<TraineeProfile> {
    return this.http.patch<TraineeProfile>(`${this.baseUrl}/${id}`, payload);
  }

  deactivate(id: string): Observable<TraineeProfile> {
    return this.http.delete<TraineeProfile>(`${this.baseUrl}/${id}`);
  }
}
