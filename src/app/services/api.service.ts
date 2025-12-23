import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private http: HttpClient
  ) {
  }

  health(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/health`);
  }
}
