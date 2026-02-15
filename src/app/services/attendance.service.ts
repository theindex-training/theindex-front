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
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  trainerId?: string;
  bucketMinutes?: number;
}

export interface AttendanceSessionAttendanceItem {
  id: string;
  trainedAt: string;
  paymentStatus: 'PAID' | 'UNPAID';
  traineeId: string;
  subscriptionId: string | null;
  price: {
    priceCents: number;
    calculation: string;
    subscriptionType: string | null;
    isFinal: boolean;
  };
}

export interface AttendanceSession {
  sessionKey: string;
  date: string;
  start: string;
  end: string;
  bucketMinutes: number;
  trainerId: string;
  locationId: string;
  attendance: AttendanceSessionAttendanceItem[];
  totals: {
    count: number;
    paid: number;
    unpaid: number;
  };
}

export interface AttendanceSessionEntity {
  id: string;
  name: string;
  nickname?: string | null;
}

export interface AttendanceSessionsResponse {
  filters: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    trainerId: string | null;
  };
  bucketMinutes: number;
  sessions: AttendanceSession[];
  entities: {
    trainees: AttendanceSessionEntity[];
    trainers: AttendanceSessionEntity[];
    locations: Array<{ id: string; name: string }>;
  };
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
    const params = buildHttpParams({
      startDate: query.startDate,
      endDate: query.endDate,
      startTime: query.startTime,
      endTime: query.endTime,
      trainerId: query.trainerId,
      bucketMinutes: query.bucketMinutes
    });

    return this.http.get<AttendanceSessionsResponse>(`${this.baseUrl}/sessions`, { params });
  }

  deleteById(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
