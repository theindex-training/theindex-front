import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

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

export interface AttendanceListItem {
  id: string;
  trainedAt: string;
  trainerId: string;
  locationId: string;
  location: {
    id: string;
    name: string;
  } | null;
}

export interface AttendanceListQuery {
  date?: string;
  trainerId?: string;
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

  list(query: AttendanceListQuery): Observable<AttendanceListItem[]> {
    const params = buildHttpParams({
      date: query.date,
      trainerId: query.trainerId
    });

    return this.http.get<AttendanceListItem[]>(this.baseUrl, { params });
  }

  sessions(query: AttendanceSessionsQuery): Observable<AttendanceSessionsResponse> {
    const params = buildHttpParams({
      date: query.date,
      trainerId: query.trainerId,
      bucketMinutes: query.bucketMinutes
    });

    return this.http.get<AttendanceSessionsResponse>(`${this.baseUrl}/sessions`, { params });
  }

  deleteById(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
