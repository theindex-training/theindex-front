import { Page, Request, Route } from '@playwright/test';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RecordedRequest {
  method: string;
  /** Path without the query string, e.g. /api/trainees/t1. */
  path: string;
  /** Query parameters, e.g. { active: 'true' }. */
  query: Record<string, string>;
  /** Parsed JSON body, or null. */
  body: unknown;
}

export interface MockResponse {
  status?: number;
  body?: unknown;
}

type Handler = MockResponse | ((request: RecordedRequest) => MockResponse);

interface Rule {
  method: Method;
  path: string | RegExp;
  handler: Handler;
  /** Respond this many times, then fall through to the next matching rule. Infinity by default. */
  times: number;
}

/**
 * Answers every /api request of a page from rules a test declares, records each request, and
 * collects any request no rule answers. The fixture fails the test if anything went unanswered,
 * so a journey proves exactly which calls a flow makes.
 * Later rules win over earlier ones, so a test can override the defaults.
 */
export class ApiMock {
  readonly requests: RecordedRequest[] = [];
  readonly unhandled: RecordedRequest[] = [];
  private readonly rules: Rule[] = [];

  constructor() {
    this.on('GET', '/api/health', { body: { status: 'ok' } });
  }

  async install(page: Page): Promise<void> {
    await page.route('**/api/**', (route) => this.handle(route));
  }

  /** Answer `method path` (exact path, or a RegExp on the path) with a response or a function. */
  on(
    method: Method,
    path: string | RegExp,
    handler: Handler,
    options: { times?: number } = {},
  ): this {
    this.rules.unshift({
      method,
      path,
      handler,
      times: options.times ?? Infinity,
    });
    return this;
  }

  /** Every recorded request for `method path`, oldest first. */
  calls(method: Method, path: string | RegExp): RecordedRequest[] {
    return this.requests.filter(
      (request) => request.method === method && matches(path, request.path),
    );
  }

  last(method: Method, path: string | RegExp): RecordedRequest | undefined {
    return this.calls(method, path).at(-1);
  }

  private async handle(route: Route): Promise<void> {
    const recorded = record(route.request());
    this.requests.push(recorded);
    const rule = this.rules.find(
      (candidate) =>
        candidate.times > 0 &&
        candidate.method === recorded.method &&
        matches(candidate.path, recorded.path),
    );
    if (!rule) {
      this.unhandled.push(recorded);
      await route.fulfill({
        status: 599,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not mocked' }),
      });
      return;
    }
    rule.times -= 1;
    const response =
      typeof rule.handler === 'function'
        ? rule.handler(recorded)
        : rule.handler;
    await route.fulfill({
      status: response.status ?? 200,
      contentType: 'application/json',
      body: response.body === undefined ? '' : JSON.stringify(response.body),
    });
  }
}

function matches(path: string | RegExp, actual: string): boolean {
  return typeof path === 'string' ? path === actual : path.test(actual);
}

function record(request: Request): RecordedRequest {
  const url = new URL(request.url());
  let body: unknown;
  try {
    body = request.postDataJSON();
  } catch {
    body = request.postData();
  }
  return {
    method: request.method(),
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    body: body ?? null,
  };
}

/** A NestJS-shaped error response. */
export function apiError(
  status: number,
  message?: string | string[],
): MockResponse {
  return {
    status,
    body: message === undefined ? undefined : { statusCode: status, message },
  };
}
