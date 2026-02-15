import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export interface TrainingTime {
  id: string;
  startTime: string;
  endTime: string;
}

export interface CreateTrainingTimePayload {
  startTime: string;
  endTime: string;
}

export interface UpdateTrainingTimePayload {
  startTime?: string;
  endTime?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingTimesService {
  private readonly baseUrl = `${environment.apiUrl}/training-times`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<TrainingTime[]> {
    return this.http.get<TrainingTime[]>(this.baseUrl);
  }

  getById(id: string): Observable<TrainingTime> {
    return this.http.get<TrainingTime>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateTrainingTimePayload): Observable<TrainingTime> {
    return this.http.post<TrainingTime>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateTrainingTimePayload): Observable<TrainingTime> {
    return this.http.patch<TrainingTime>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
