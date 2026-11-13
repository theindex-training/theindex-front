import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

/** A gym a trainee can book in. */
export interface BookingGym {
  id: string;
  name: string;
  /** The trainee's preferred gym (set on their profile by the staff). */
  preferred: boolean;
}

/** A training of a created week as a trainee sees it (theindex-api `bookings`). */
export interface BookableTraining {
  id: string;
  /** The gym-local day, YYYY-MM-DD. */
  date: string;
  weekday: number;
  trainingTime: { startTime: string; endTime: string };
  trainer: { name: string; nickname: string | null };
  /** The day's workout it follows, by its title only. */
  workout: { title: string | null } | null;
  startsAt: string;
  /** How many trainees booked it; trainees never see who. */
  bookedCount: number;
  bookedByMe: boolean;
  /** Booking is open until this moment (30 minutes before the start). */
  bookingClosesAt: string;
  /** A booking can be cancelled until this moment (1 hour before the start). */
  cancelUntil: string;
  canBook: boolean;
  canCancel: boolean;
}

/** An exercise of a training's workout, as a trainee sees it. */
export interface TrainingExercise {
  id: string;
  name: string;
  description: string | null;
  /** `https://www.youtube.com/watch?v=<id>`, or null. */
  videoUrl: string | null;
}

/** One training with its gym and its whole workout (`GET /api/bookings/trainings/:slotId`). */
export interface TrainingDetails extends Omit<BookableTraining, 'workout'> {
  gym: { id: string; name: string };
  /** null until the staff pick the day's workout for this training. */
  workout: {
    title: string | null;
    /** Plain text; its line breaks matter. */
    summary: string;
    /** In the workout's order. */
    exercises: TrainingExercise[];
  } | null;
}

export interface BookingWeek {
  gym: BookingGym;
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  weekEnd: string;
  /** null until the staff create the week: nothing can be booked before. */
  week: { id: string } | null;
  /** In the order of the day: by day, start, end and trainer. */
  slots: BookableTraining[];
}

/** Trainees' bookings: always their own (the API takes the profile from the token). */
@Injectable({
  providedIn: 'root',
})
export class BookingsService {
  private readonly baseUrl = `${environment.apiUrl}/bookings`;

  constructor(private readonly http: HttpClient) {}

  gyms(): Observable<BookingGym[]> {
    return this.http.get<BookingGym[]>(`${this.baseUrl}/gyms`);
  }

  /** A gym's week; `week` is any day of it. */
  week(gymId: string, week: string): Observable<BookingWeek> {
    const params = buildHttpParams({ gymId, week });
    return this.http.get<BookingWeek>(`${this.baseUrl}/schedule`, {
      params,
    });
  }

  /** One training, booked or not, with its whole workout. */
  training(slotId: string): Observable<TrainingDetails> {
    return this.http.get<TrainingDetails>(
      `${this.baseUrl}/trainings/${slotId}`,
    );
  }

  book(slotId: string): Observable<BookableTraining> {
    return this.http.post<BookableTraining>(this.baseUrl, { slotId });
  }

  cancel(slotId: string): Observable<BookableTraining> {
    return this.http.delete<BookableTraining>(`${this.baseUrl}/${slotId}`);
  }
}
