import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export interface GymLocation {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface CreateGymLocationPayload {
  name: string;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateGymLocationPayload {
  name?: string;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GymLocationsService {
  private readonly baseUrl = `${environment.apiUrl}/gym-locations`;

  constructor(private readonly http: HttpClient) {}

  list(includeInactive?: boolean): Observable<GymLocation[]> {
    let params = new HttpParams();
    if (includeInactive !== undefined) {
      params = params.set('includeInactive', String(includeInactive));
    }
    return this.http.get<GymLocation[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<GymLocation> {
    return this.http.get<GymLocation>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateGymLocationPayload): Observable<GymLocation> {
    return this.http.post<GymLocation>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateGymLocationPayload): Observable<GymLocation> {
    return this.http.patch<GymLocation>(`${this.baseUrl}/${id}`, payload);
  }

  deactivate(id: string): Observable<GymLocation> {
    return this.http.delete<GymLocation>(`${this.baseUrl}/${id}`);
  }
}
