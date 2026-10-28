# theindex-front

Angular SPA for The Index, a CrossFit gym app (admin/trainer management screens plus a trainee dashboard). The backend lives in the sibling repo `theindex-training/theindex-api`.

## Stack
- Angular 21 with standalone components, lazy `loadComponent` routes, functional guards/interceptor, and the new control flow (`@if`/`@for`)
- TypeScript ~5.9 (strict, `strictTemplates`), SCSS, RxJS 7, `@angular/build` (esbuild) builder
- Tests: Vitest 4 + jsdom through `ng test` (`@angular/build:unit-test`)
- Node 20 (`.nvmrc`, Docker `node:20-alpine`); production image is `nginx:alpine` serving `dist/theindex-front/browser`
- No ESLint is configured. Prettier settings sit in `package.json` (printWidth 100, single quotes, angular parser for HTML), but prettier is not a dependency.

## Commands
```bash
npm ci                       # install
npm start                    # ng serve on :4200, proxies /api -> http://localhost:3000
npm run build                # production build -> dist/theindex-front/browser
npm run watch                # dev build in watch mode
npx ng test --watch=false    # run unit tests once (`npm test` starts watch mode)
```
For a working UI locally, also run theindex-api (`npm run start:dev` there, with Postgres) and log in as the seeded admin (`admin`/`admin` with the API's `.env.example`).

Known baseline on `main` (as of Oct 2026): build passes with no warnings. `ng test` has 2 of 4 tests failing in stale scaffold specs: `app.component.spec.ts` expects an `<h1>` "Hello, theindex-front", and `home.component.spec.ts` lacks router/HttpClient providers. Don't treat these as regressions you caused, and don't hide them either.

## Folder structure
```
src/
  main.ts, index.html, styles.scss
  environments/           # environment.ts / environment.development.ts (apiUrl: '/api'), imported as '@environments/environment'
  app/
    app.config.ts         # provideHttpClient(withInterceptors([authInterceptor])), provideRouter
    app.routes.ts         # all routes; role restrictions via data: { roles: [...] } + roleGuard
    pages/<feature>/      # one folder per feature: list, -create, -edit, -details, -delete components
    components/           # shared UI (main-layout, ui-button/input/checkbox, trainee tables)
    services/             # one service per API resource + auth.service, auth.interceptor
    guards/               # authGuard, loginGuard, roleGuard
    utils/                # buildHttpParams, display/time formatting helpers
public/                   # static assets
```

## API conventions (how the app calls theindex-api)
- All HTTP goes through `HttpClient` in `src/app/services/*.service.ts`, built on `${environment.apiUrl}/<resource>` (e.g. `PlansService.baseUrl = '/api/plans'`). Components never build URLs themselves.
- Each service declares its own TypeScript interfaces for entities and payloads (`Plan`, `CreatePlanPayload`, `UpdatePlanPayload`). These mirror the API DTOs/entities by hand; nothing generates them.
- Methods follow the REST shape `list` / `getById` / `create` (POST) / `update` (PATCH) / `delete`/`deactivate` (DELETE). Build query strings with `buildHttpParams()` from `utils/http-params.util.ts`; it drops undefined/null/empty values.
- Auth: `AuthService.login()` posts to `/api/auth/login` and stores `accessToken` in `localStorage`. `authInterceptor` adds `Authorization: Bearer <token>` and on 401 logs out and redirects to `/login`. Role, email and profile ids are decoded client-side from the JWT payload (`role`, `email`, `sub`, `trainerProfileId`, `traineeProfileId`).
- Roles are the strings `ADMIN`, `TRAINER`, `TRAINEE`. The API enforces them; `roleGuard` only gates navigation (trainees get redirected to `/my-profile`).
- Components subscribe directly, track `loading`/`errorMessage` fields, show `error?.error?.message` from API errors, and call `ChangeDetectorRef.detectChanges()` after async updates. Money arrives as integer cents (`priceCents`), formatted as EUR.

## How this repo relates to theindex-api
- The API serves everything under `/api` (Swagger at `/api/docs` when running locally). Dev: `proxy.conf.json` forwards `/api` to `localhost:3000`. Prod: the nginx image only serves static files plus the SPA fallback; `/api` routing to the API container comes from the `docker compose` setup on the VPS (`/opt/theindex`), which is in neither repo.
- If you need an endpoint or field that doesn't exist, the change belongs in theindex-api first. Keep service interfaces in sync with the API's DTOs/entities, and flag cross-repo changes to the user.

## Rules
- **Don't modify `.github/workflows/` (deploy pipeline), `Dockerfile` (nginx config) or `proxy.conf.json` without asking first.** Every push to `main` builds the image, pushes it to GHCR and redeploys the production VPS over SSH.
- Don't push to `main`; work on a branch and open a PR.
- Follow the existing patterns: standalone components, lazy routes in `app.routes.ts` with `roleGuard` + `data.roles`, one service per resource, `@if`/`@for` in templates, SCSS per component.
- Stay within the production budgets in `angular.json` (initial 500kB warn / 1MB error; component styles 4kB warn / 8kB error).
- Never hardcode API hosts. Always go through `environment.apiUrl`.
- Run `npm run build` and `npx ng test --watch=false` before pushing.
