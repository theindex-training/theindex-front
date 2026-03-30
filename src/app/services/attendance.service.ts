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

export interface AttendanceTraineeTrainingItem {
  id: string;
  traineeId: string;
  trainerId: string;
  trainer: {
    id: string;
    name: string;
    nickname?: string | null;
  };
  locationId: string;
  location: {
    id: string;
    name: string;
    address?: string | null;
  };
  trainedAt: string;
  subscriptionId: string | null;
  gymSubscriptionId: string | null;
  paymentStatus: 'PAID' | 'UNPAID';
  createdAt: string;
}

export interface AttendanceSessionsResponse {
  filters: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    trainerId: string | null;
  };
  sessions: AttendanceSession[];
  entities: {
    trainees: AttendanceSessionEntity[];
    trainers: AttendanceSessionEntity[];
    locations: Array<{ id: string; name: string }>;
  };
}

export interface InactiveTraineesReportQuery {
  skipDays: number;
}

export interface AttendanceSubscriptionReport {
  planName: string | null;
  type: string | null;
  startDate: string | null;
  endDate: string | null;
  remainingTrainings: number | null;
  remainingDays: number | null;
}

export interface InactiveTraineeReportItem {
  name?: string;
  nickname?: string | null;
  traineeId?: string;
  lastTrainingDate: string | null;
  activeSubscription: AttendanceSubscriptionReport | null;
}

export interface TraineeWithoutActiveSubscriptionReportItem {
  name?: string;
  nickname?: string | null;
  traineeId?: string;
  lastTrainingDate: string | null;
  lastActiveSubscription: AttendanceSubscriptionReport | null;
}

@Injectable({
  providedIn: 'root',
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
    });

    return this.http.get<AttendanceSessionsResponse>(`${this.baseUrl}/sessions`, { params });
  }

  deleteById(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  listPaidForTrainee(traineeId: string): Observable<AttendanceTraineeTrainingItem[]> {
    return this.http.get<AttendanceTraineeTrainingItem[]>(
      `${this.baseUrl}/trainees/${traineeId}/paid`,
    );
  }

  listForTrainee(traineeId: string): Observable<AttendanceTraineeTrainingItem[]> {
    return this.http.get<AttendanceTraineeTrainingItem[]>(`${this.baseUrl}/trainees/${traineeId}`);
  }

  listUnpaidForTrainee(traineeId: string): Observable<AttendanceTraineeTrainingItem[]> {
    return this.http.get<AttendanceTraineeTrainingItem[]>(
      `${this.baseUrl}/trainees/${traineeId}/unpaid`,
    );
  }

  getInactiveTraineesReport(
    query: InactiveTraineesReportQuery,
  ): Observable<InactiveTraineeReportItem[]> {
    const params = buildHttpParams({
      skipDays: query.skipDays,
    });

    return this.http.get<InactiveTraineeReportItem[]>(`${this.baseUrl}/reports/inactive-trainees`, {
      params,
    });
  }

  getTraineesWithoutActiveSubscriptionReport(): Observable<
    TraineeWithoutActiveSubscriptionReportItem[]
  > {
    return this.http.get<TraineeWithoutActiveSubscriptionReportItem[]>(
      `${this.baseUrl}/reports/without-active-subscription`,
    );
  }
}
