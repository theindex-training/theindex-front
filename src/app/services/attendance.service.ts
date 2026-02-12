import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export interface CreateAttendanceBatchPayload {
  trainerId: string;
  traineeIds: string[];
  locationId: string;
  trainedDate: string;
  trainedTime?: string;
}

export interface AttendanceBatchResponse {
  trainerId: string;
  trainedAt: string;
  count: number;
  results: unknown[];
}

export interface AttendanceSessionsQuery {
  date: string;
  trainerId?: string;
  bucketMinutes?: number;
}

export interface AttendanceSessionAttendanceItem {
  id: string;
  trainedAt: string;
  paymentStatus: 'PAID' | 'UNPAID';
  trainee: {
    id: string;
    name: string;
    nickname: string | null;
  };
}

export interface AttendanceSession {
  sessionKey: string;
  date: string;
  start: string;
  end: string;
  bucketMinutes: number;
  trainer: {
    id: string;
    name: string;
    nickname: string | null;
  } | null;
  location: {
    id: string;
    name: string;
  } | null;
  attendance: AttendanceSessionAttendanceItem[];
  totals: {
    count: number;
    paid: number;
    unpaid: number;
  };
}

export interface AttendanceSessionsResponse {
  date: string;
  trainerId: string | null;
  bucketMinutes: number;
  sessions: AttendanceSession[];
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private readonly baseUrl = `${environment.apiUrl}/attendance`;

  constructor(private readonly http: HttpClient) {}

  createBatch(payload: CreateAttendanceBatchPayload): Observable<AttendanceBatchResponse> {
    return this.http.post<AttendanceBatchResponse>(`${this.baseUrl}/batch`, payload);
  }

  sessions(query: AttendanceSessionsQuery): Observable<AttendanceSessionsResponse> {
    let params = new HttpParams().set('date', query.date);

    if (query.trainerId) {
      params = params.set('trainerId', query.trainerId);
    }

    if (query.bucketMinutes) {
      params = params.set('bucketMinutes', String(query.bucketMinutes));
    }

    return this.http.get<AttendanceSessionsResponse>(`${this.baseUrl}/sessions`, { params });
  }
}
