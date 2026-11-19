import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageDriver, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { TrainerProfile } from '../../services/trainers.service';
import { TrainersComponent } from './trainers.component';

const PHOTO = 'https://media.test/profile-photos/ivo/s128.webp';

const trainer = (
  id: string,
  name: string,
  extra: Partial<TrainerProfile> = {},
): TrainerProfile => ({
  id,
  name,
  nickname: null,
  accountId: null,
  isActive: true,
  ...extra,
});

describe('TrainersComponent', () => {
  let http: HttpTestingController;
  let page: PageDriver;

  beforeEach(() => {
    localStorage.clear();
    signInAs('ADMIN');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("shows a trainer's photo on the table and the phone list, and initials without one", async () => {
    const fixture = TestBed.createComponent(TrainersComponent);
    page = driver(
      () => fixture.nativeElement as HTMLElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    http
      .expectOne((req) => req.method === 'GET' && req.url === '/api/trainers')
      .flush([
        trainer('tr1', 'Coach Ivo', { photoUrl: PHOTO }),
        trainer('tr2', 'Maria Koleva', { photoUrl: null }),
      ]);
    await page.settle();

    // Ivo's photo, once in the table and once in the phone list.
    expect(
      page
        .queryAll('[data-testid="avatar-photo"]')
        .map((img) => img.getAttribute('src')),
    ).toEqual([PHOTO, PHOTO]);
    const rows = page.queryAll('table tbody tr');
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe(PHOTO);
    expect(rows[1].querySelector('img')).toBeNull();
    expect(rows[1].querySelector('app-avatar')?.textContent?.trim()).toBe('MK');
  });
});
