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
  gymSubscriptionId: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface CreateTraineePayload {
  name: string;
  nickname?: string | null;
  phone?: string | null;
  isActive?: boolean;
  gymSubscriptionId?: string | null;
}


export interface TraineeTrainingInsights {
  traineeId: string;
  totalAttendances: number;
  topTrainingPartners: {
    traineeId: string;
    traineeName: string;
    trainingsTogether: number;
  }[];
  topTrainers: {
    trainerId: string;
    trainerName: string;
    trainingsCount: number;
  }[];
  topGyms: {
    gymId: string;
    gymName: string;
    trainingsCount: number;
  }[];
  topWeekdays: {
    weekday: string;
    weekdayNumber: number;
    trainingsCount: number;
  }[];
  topTimeSlots: {
    timeSlot: string;
    trainingsCount: number;
  }[];
}

export interface UpdateTraineePayload {
  name?: string;
  nickname?: string | null;
  phone?: string | null;
  isActive?: boolean;
  gymSubscriptionId?: string | null;
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

  getMyTrainingInsights(): Observable<TraineeTrainingInsights> {
    return this.http.get<TraineeTrainingInsights>(`${this.baseUrl}/me/training-insights`);
  }
}
