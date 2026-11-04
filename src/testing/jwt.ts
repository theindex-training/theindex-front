/**
 * Test helpers for auth state. Plain TypeScript with no test-framework globals and no app imports:
 * tsconfig.app.json type-checks every file under src/ except *.spec.ts, so this file must compile
 * in the app build too (nothing in the app imports it, so it is never bundled).
 */

export type TestRole = 'ADMIN' | 'TRAINER' | 'TRAINEE';

export interface TestClaims {
  sub?: string;
  email?: string;
  role?: string;
  trainerProfileId?: string | null;
  traineeProfileId?: string | null;
  iat?: number;
  exp?: number;
}

/** Base64url without padding, like a real JWT segment. */
export function base64UrlEncode(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** An unsigned JWT-shaped token carrying the given payload. The app never verifies signatures. */
export function makeToken(
  claims: TestClaims | Record<string, unknown>,
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  return `${header}.${payload}.test-signature`;
}

const DEFAULT_CLAIMS: Record<TestRole, TestClaims> = {
  ADMIN: { sub: 'account-admin', email: 'admin@theindex.test', role: 'ADMIN' },
  TRAINER: {
    sub: 'account-trainer',
    email: 'trainer@theindex.test',
    role: 'TRAINER',
    trainerProfileId: 'trainer-1',
  },
  TRAINEE: {
    sub: 'account-trainee',
    email: 'trainee@theindex.test',
    role: 'TRAINEE',
    traineeProfileId: 'trainee-1',
  },
};

/** The claims of a test user with this role: the defaults above, overridden by `claims`. */
export function claimsFor(role: TestRole, claims: TestClaims = {}): TestClaims {
  return { ...DEFAULT_CLAIMS[role], ...claims };
}

/** Stores a token for the role (defaults above, overridden by `claims`) and returns it. */
export function signInAs(role: TestRole, claims: TestClaims = {}): string {
  const token = makeToken(claimsFor(role, claims));
  localStorage.setItem('accessToken', token);
  return token;
}
