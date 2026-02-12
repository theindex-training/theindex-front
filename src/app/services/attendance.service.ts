import { HttpClient } from '@angular/common/http';
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

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private readonly baseUrl = `${environment.apiUrl}/attendance`;

  constructor(private readonly http: HttpClient) {}

  createBatch(payload: CreateAttendanceBatchPayload): Observable<AttendanceBatchResponse> {
    return this.http.post<AttendanceBatchResponse>(`${this.baseUrl}/batch`, payload);
  }
}
