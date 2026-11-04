import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { makeToken } from '../../testing/jwt';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/trainees');
  });

  afterEach(() => controller.verify());

  /** Sends a GET and returns the HTTP status the caller saw, if it failed. */
  function get(url = '/api/trainees') {
    const result: { status?: number; body?: unknown } = {};
    http.get(url).subscribe({
      next: (body) => (result.body = body),
      error: (error) => (result.status = error.status),
    });
    return result;
  }

  it('adds the bearer token when one is stored', () => {
    const token = makeToken({ sub: 'a1', role: 'ADMIN' });
    localStorage.setItem('accessToken', token);

    get();

    const req = controller.expectOne('/api/trainees');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
  });

  it('sends no Authorization header without a token', () => {
    get();

    const req = controller.expectOne('/api/trainees');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('reads the token per request, so a fresh login is used right away', () => {
    get('/api/health');
    controller.expectOne('/api/health').flush({});

    const auth = TestBed.inject(AuthService);
    const token = makeToken({ sub: 'a1', role: 'TRAINER' });
    auth.login('trainer', 'secret').subscribe();
    controller
      .expectOne('/api/auth/login')
      .flush({ accessToken: token, account: {} });

    get();
    const req = controller.expectOne('/api/trainees');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
  });

  it('on a 401 with a token: logs out, goes to /login and still passes the error on', async () => {
    localStorage.setItem(
      'accessToken',
      makeToken({ sub: 'a1', role: 'ADMIN' }),
    );

    const result = get();
    controller
      .expectOne('/api/trainees')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await new Promise((resolve) => setTimeout(resolve));

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(router.url).toBe('/login');
    expect(result.status).toBe(401);
  });

  it('on a 401 without a token (e.g. a wrong password): no logout, no redirect', async () => {
    const result = get('/api/auth/login');
    controller
      .expectOne('/api/auth/login')
      .flush(
        { message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await new Promise((resolve) => setTimeout(resolve));

    expect(router.url).toBe('/trainees');
    expect(result.status).toBe(401);
  });

  it.each([403, 500, 0])('keeps the session on a %s error', async (status) => {
    const token = makeToken({ sub: 'a1', role: 'ADMIN' });
    localStorage.setItem('accessToken', token);

    const result = get();
    controller
      .expectOne('/api/trainees')
      .flush(null, { status, statusText: 'Error' });
    await new Promise((resolve) => setTimeout(resolve));

    expect(localStorage.getItem('accessToken')).toBe(token);
    expect(router.url).toBe('/trainees');
    expect(result.status).toBe(status);
  });
});
