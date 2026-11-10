# theindex-front

Angular SPA for The Index, a CrossFit gym app (admin/trainer management screens plus a trainee dashboard). The backend lives in the sibling repo `theindex-training/theindex-api`.

## Stack
- Angular 22 with standalone components, lazy `loadComponent` routes, functional guards/interceptor, and the new control flow (`@if`/`@for`)
- Angular 22 changed three defaults; the v22 migration pinned the old behavior, so keep it that way unless you mean to change it:
  - Components default to OnPush. Every existing component sets `changeDetection: ChangeDetectionStrategy.Eager`, because the pages mutate plain fields and call `detectChanges()` themselves. Give new components `Eager` too, unless they are built on signals.
  - `HttpClient` defaults to `fetch`. `app.config.ts` keeps the XHR backend with `withXhr()`.
  - A template `?.` on a missing value now yields `undefined` instead of `null`, as in plain JavaScript. The migration wrapped such reads in `$safeNavigationMigration(...)` to keep `null`; those wrappers were reviewed and removed, because no template here depends on the difference. Don't add the wrapper to new code; make the consumer handle both (e.g. a truthiness check).
- TypeScript ~6.0 (Angular 22 needs `>=6.0 <6.1`; strict, `strictTemplates`), SCSS, RxJS 7, `@angular/build` (esbuild) builder
- Tests: Vitest 5 + jsdom through `ng test` (`@angular/build:unit-test`); `src/test-providers.ts` gives every spec Transloco with the real language files (English)
- i18n: Transloco (`@jsverse/transloco`) + `@jsverse/transloco-messageformat` (ICU plurals), runtime switching between Bulgarian (default) and English. See "Internationalization".
- Editor.js 2.31 (`@editorjs/editorjs` with the header, list, quote and delimiter tools) for article bodies, only in the editor's lazy chunk. See "Content area".
- Node 24 LTS (`.nvmrc`, Docker `node:24-alpine`; CI reads `.nvmrc`); production image is `nginx:alpine` serving `dist/theindex-front/browser`
- Lint and format, set up like theindex-api:
  - ESLint 10 flat config (`eslint.config.mjs`): `@eslint/js`, type-checked typescript-eslint, angular-eslint (TS, templates, template accessibility) and eslint-plugin-prettier. The comments in the config say why each rule is relaxed; keep the API's relaxations in step with it.
  - Prettier 3 (`.prettierrc`): the API's settings (single quotes, trailing commas, default printWidth 80) plus the `angular` parser for HTML. `.prettierignore` leaves Markdown, `docs/` and `.github/` alone.
  - `e2e/` and `playwright.config.ts` are type-checked by `tsconfig.e2e.json` (referenced from `tsconfig.json`, so ESLint's project service finds them).

## Commands
```bash
npm ci                       # install
npm start                    # ng serve on :4200, proxies /api -> http://localhost:3000
npm run build                # production build -> dist/theindex-front/browser
npm run watch                # dev build in watch mode
npx ng test --watch=false    # run unit tests once (`npm test` starts watch mode)
npm run e2e                  # Playwright E2E journeys (starts `ng serve` itself; API is mocked)
npm run lint:check           # ESLint (TS + templates, Prettier included) without fixing; fails on any error or warning (CI gate)
npm run lint                 # NOTE: runs eslint --fix and rewrites files
npm run format:check         # Prettier check of everything it formats, SCSS and JSON included (CI gate)
npm run format               # prettier --write .
npm run typecheck:e2e        # tsc over e2e/ and playwright.config.ts (CI gate)
```
For a working UI locally, also run theindex-api (`npm run start:dev` there, with Postgres) and log in as the seeded admin (`admin`/`admin` with the API's `.env.example`).

Known baseline (as of Nov 2026): build passes with no warnings, all `ng test` specs and E2E journeys pass, and `npm run lint:check`, `npm run format:check` and `npm run typecheck:e2e` are clean (0 errors, 0 warnings). Keep it that way; a failing spec or a new lint warning is a regression.

The whole repo was reformatted once in a reformat-only commit, listed in `.git-blame-ignore-revs` (`git config blame.ignoreRevsFile .git-blame-ignore-revs` to skip it locally; GitHub's blame skips it already).

## Testing (characterization tests)
We are adding characterization tests to a production app. The plan and its progress live in `TEST_PLAN.md`; anything a test reveals that looks wrong goes in `TEST_NOTES.md`.

**The spec is current production behavior.** Tests describe what the app does today, not what it should do.
- **Never change production code to make a test pass.** The one exception: adding `data-testid` attributes to templates.
- **If behavior looks like a bug,** test the current behavior anyway. Put a `// CHARACTERIZATION: possibly unintended` comment on the assertion and add an entry to `TEST_NOTES.md` (what happens, where, why it looks wrong, the spec that pins it). Fixing it is a separate, deliberate change.
- **When fixing a bug later,** first add (or flip) a test that reproduces it and fails, then fix the code, then update the `TEST_NOTES.md` entry.

**What to unit-test** (Vitest via `npx ng test --watch=false`, specs next to the code as `*.spec.ts`):
- Logic: services, guards, the interceptor, pipes, utils, i18n helpers, and components with real logic (payload building, validation, filtering, role checks, state after success/error).
- Not purely presentational components (chip, icon, status-dot, skeleton, empty-state, page-header, brand, list-row…). Their output is covered through the pages that use them and by E2E.
- Don't test Angular or libraries themselves (e.g. that `Validators.required` works); test our use of them.

**Mock only at boundaries:**
- HTTP: `provideHttpClient()` + `provideHttpClientTesting()` and `HttpTestingController`. Assert method, URL, query params and body; `verify()` in `afterEach`. Use the real services, interceptor, router and Transloco (already provided by `src/test-providers.ts`).
- Time: `vi.useFakeTimers()` / `vi.setSystemTime()` for anything that depends on "today" or the timezone.
- Storage: jsdom's real `localStorage`, cleared in `beforeEach`. Build JWTs with a helper that base64url-encodes a payload; never paste real tokens.
- Browser dialogs and media queries (`window.confirm`, `matchMedia`) may be stubbed with `vi.spyOn`.
- Don't mock our own services, guards or components to test another unit of ours. Navigation is checked through the real router (`provideRouter` with stub routes, then `router.url`), not a spied `navigate`.

**Every test must fail if the behavior it covers is broken.**
- "should create" and "renders without error" don't count on their own.
- Assert the observable outcome: the request sent, the URL navigated to, the value stored, the text or state shown.
- For P0/P1 items in the plan, break the code locally once (flip a condition, drop a field) and watch the test fail before committing.

**Shared test helpers** live in `src/testing/`:
- `jwt.ts`: `makeToken`, `signInAs`.
- `dom.ts`: `driver(...)` to type, select, submit and settle; `apiError(...)` for NestJS-shaped errors.

They are plain TypeScript with no Vitest globals, because the app build type-checks them. Every spec runs in `Europe/Sofia` (set in `src/test-providers.ts`); for "today" logic, fake only `Date` at a time near midnight, so local and UTC dates differ.

**The app is zoneless.** Nothing re-renders after an async callback unless the code calls `detectChanges()`/`markForCheck()` or a signal changes. In component specs, `await fixture.whenStable()` after flushing HTTP, and assert on what the user would actually see. Where the component state and the DOM disagree, that is behavior to characterize (see `TEST_NOTES.md`).

**Pages that navigate away** (after a save, a generate, a delete) must be rendered through `RouterTestingHarness` with the page on its own route, as in `plan-edit.component.spec.ts`, not with `TestBed.createComponent`. Since Angular 21.2, `RouterLink` reads router-state signals that change on `NavigationEnd`, which schedules a tick. A page created outside the outlet is still alive at that tick, and the dev-mode check throws NG0100 for any field set without `markForCheck()`. In the app, the outlet destroys the page first.

**E2E selectors** (Playwright, see `TEST_PLAN.md`):
- Use only roles (`getByRole`), accessible names and labels (`getByLabel`), or `data-testid` (`getByTestId`).
- Never CSS classes, tag structure (`div > span:nth-child(2)`), or visible copy that is likely to change in a redesign.
- Accessible names come from the translation files. Resolve them with a helper that reads `public/i18n/en.json` by key, so a copy change doesn't break the test but a missing label does.
- Need a hook that has no role or label (a balance figure, a count)? Add a `data-testid` in the template. That is the only allowed production change; name it `<feature>-<thing>`, e.g. `cash-register-balance`.
- Mock the API at the network boundary (`page.route('**/api/**')`) with fixtures shaped like theindex-api responses, and assert the requests the page sends.

**E2E layout** (`e2e/`, Playwright, files named `*.e2e.ts` so `ng test` never picks them up):
- `e2e/support/fixtures.ts` gives every test:
  - `api`, an `ApiMock`: `api.on(method, path, response)` answers requests, and `api.calls()` / `api.last()` return what was sent. Any `/api` request without a rule fails the test.
  - `signInAs(role, claims?)` / `seedToken(token)`, which seed `localStorage` once per tab, so a reload or logout behaves as in real use.
- The UI starts in English. `t(key, params)` and `tBg(...)` in `e2e/support/i18n.ts` give the shown text for a translation key.
- Response fixtures shaped like the API's DTOs live in `e2e/support/data.ts`.
- Pick viewports with tags: `{ tag: '@desktop' }` (1280×800), `'@mobile'` (390×844), or both. The browser runs in `Europe/Sofia` time.
- Locally, Playwright uses the Chromium in `PLAYWRIGHT_BROWSERS_PATH`; `@playwright/test` is pinned to match it. CI installs its own Chromium.
- Lessons from writing J1–J9:
  - **Requests:** `api.calls()` / `api.last()` read what has been sent so far. Right after a navigation, wrap them in `expect.poll(...)`.
  - **Lists render twice** (a desktop table and a phone list, one hidden by CSS). For text, use `getByText(...).filter({ visible: true })`; roles already skip hidden elements.
  - **Segmented controls** (filters, theme, language) use visually hidden radios. Click the option's text inside `getByRole('group', { name: <legend> })`, then assert `getByRole('radio', { name })`.
  - **Translated names:** landmark and dialog names are translated too. After switching to Bulgarian, find them with `tBg(...)` (or by role alone).
  - **Ambiguous labels:** `getByLabel` matches substrings and `aria-label`s ("Password" vs "Show password", "Trainer" vs "Trainer totals table"). Use `{ exact: true }`, or a role with a name.

## Folder structure
```
src/
  main.ts, index.html (fonts + pre-boot theme/language script), styles.scss (design tokens + base styles)
  environments/           # environment.ts / environment.development.ts (apiUrl: '/api'), imported as '@environments/environment'
  app/
    app.config.ts         # provideHttpClient(withInterceptors([authInterceptor])), provideRouter, provideI18n()
    app.routes.ts         # all routes; role restrictions via data: { roles: [...] } + roleGuard; title = translation key
    i18n/                 # LanguageService, Transloco setup, LocaleFormatService, UiMessage, enum labels, key tests
    pages/<feature>/      # one folder per feature: list, -create, -edit, -details, -delete components
    pages/workouts/       # workouts of the day (ADMIN, TRAINER): week list, workout form with PDF import, exercises/, types/; see "Workouts area"
    pages/content/        # the public site's back office (ADMIN): articles/ (list, editor), categories/, media/ (picker); see "Content area"
    components/           # shared UI: navigation shell (main-layout, sidebar, tab-bar, nav-sheet, brand, theme-switch, language-switch, user-block, icon, navigation.ts), list page pieces (page-header, search-field, segmented-control, chip, avatar, status-dot, list-row, empty-state, skeleton-list), ui-button/input, trainee tables, ranked-list
    services/             # one service per API resource + auth.service, auth.interceptor, theme.service
    guards/               # authGuard, loginGuard, roleGuard
    utils/                # buildHttpParams, display/time formatting helpers
public/                   # static assets; brand/ holds the official logo PNGs; i18n/bg.json + en.json (bundled, not copied; see Internationalization)
```

## API conventions (how the app calls theindex-api)
- All HTTP goes through `HttpClient` in `src/app/services/*.service.ts`, built on `${environment.apiUrl}/<resource>` (e.g. `PlansService.baseUrl = '/api/plans'`). Components never build URLs themselves.
- Each service declares its own TypeScript interfaces for entities and payloads (`Plan`, `CreatePlanPayload`, `UpdatePlanPayload`). These mirror the API DTOs/entities by hand; nothing generates them.
- Methods follow the REST shape `list` / `getById` / `create` (POST) / `update` (PATCH) / `delete`/`deactivate` (DELETE). Build query strings with `buildHttpParams()` from `utils/http-params.util.ts`; it drops undefined/null/empty values.
- Auth: `AuthService.login()` posts to `/api/auth/login` and stores `accessToken` in `localStorage`. `authInterceptor` adds `Authorization: Bearer <token>` and on 401 logs out and redirects to `/login`. Role, email and profile ids are decoded client-side from the JWT payload (`role`, `email`, `sub`, `trainerProfileId`, `traineeProfileId`).
- Roles are the strings `ADMIN`, `TRAINER`, `TRAINEE`. The API enforces them; `roleGuard` only gates navigation (trainees get redirected to `/my-profile`).
- Components subscribe directly, track `loading`/`errorMessage` fields, show `error?.error?.message` from API errors, and call `ChangeDetectorRef.detectChanges()` after async updates. Money arrives as integer cents (`priceCents`), formatted as EUR.

## Renewals (`/renewals`)
ADMIN and TRAINER, the menu item right under Dashboard (first in the More sheet on phones). `pages/renewals/` shows `GET /api/subscription-renewals` (`SubscriptionRenewalsService`): active trainees who have had a subscription, in a Punch or Time tab (an `app-segmented-control`), each with a used up/expired section and an active one. The API decides the tab, the sections and the order (theindex-api `subscriptions/subscription-renewals.ts`); the page only formats them. The Dashboard's "without active subscription" report is separate and unchanged.

## Workouts area (`/workouts`)
The workout of the day, for ADMIN and TRAINER (every `workouts/...` route has `roleGuard` + `data: { roles: ['ADMIN', 'TRAINER'] }`); trainees don't see workouts yet. One nav item ("Workouts", main group, in the More sheet on phones); `app-workouts-nav` (`pages/workouts/workouts-nav.component.ts`) is the Workouts / Exercises / Types tab row under the header of the three list pages. The data model is theindex-api's (see its CLAUDE.md): a workout has parts (type + score), each part one variant per level (RX always), each variant its structure and items.
- **Week list** (`/workouts`, `WorkoutsService` → `/api/workouts?from&to`): Monday to Sunday, a day at a time, each workout written out per level; an empty day links to `/workouts/new?date=`. `?week=YYYY-MM-DD` (any day of the week) picks the week, and the page follows the parameter when only it changes (the page is reused, so it subscribes to `queryParamMap`). The text of a workout comes from the pure `workout-format.ts` (`structurePhrases`, `itemLine`), with units and phrases from `workouts.format.*`.
- **Workout form** (`/workouts/new`, `/workouts/:id/edit`, one component, `workout-edit.component`): date, name, notes, then the parts. A part has a type (choosing it sets the score, which stays editable), an optional heading and its levels; "Add Intermediate / Beginner" copies RX. `app-workout-variant` renders one level: the structure fields its type uses (`structureFields` in `workout-form.ts`; a field with a value is never hidden) and the exercise rows (exercise, counted in, amount, load, and "More options" for range, women's values, % of 1RM, interval number, note, max effort). Delete is a button on the edit page behind `window.confirm`.
  - `workout-form.ts` is the form's model, pure and unit-tested: builders, `fillFromWorkout` / `fillFromDraft`, `workoutPayload`, and `itemProblem`, which mirrors the API's `workout-rules.ts`. Times are typed as `m:ss` and always need the colon (`parseClock`), so "12" is never guessed at; rep schemes as `21-15-9`.
  - **From a PDF**: "Choose a PDF" posts the file to `/api/workouts/import-pdf` and puts the draft in the form; nothing is saved until the form is submitted, and Save and Delete are off while the PDF is being read. Movements the catalogue lacks are listed with a category select and a "Create" button (`ExercisesService.create`), and their rows stay invalid until then. The API's warnings are shown as they come (English).
- **Exercises** (`/workouts/exercises`, `ExercisesService` → `/api/exercises`) and **workout types** (`/workouts/types`, `WorkoutTypesService` → `/api/workout-types`): a list plus one create/edit page each (`exercise-edit`, `workout-type-edit`; the id in the route decides), with delete on the edit page behind `window.confirm`. The exercise list filters on the client (name or alias, status) and links each exercise's YouTube video (new tab). The exercise form has an optional description and video link; `utils/youtube.util.ts` checks the link with the API's rules, and the API stores it as `https://www.youtube.com/watch?v=<id>`. The starter catalogue (the API's) has crossfit.com's movements with their videos and no descriptions. Built-in types show a "Built-in" chip and have no delete.

## Content area (`/content`)
The back office of the public site `theindex.training` (the sibling repo `theindex-training/theindex-web`; its `docs/decision-record.md` is the reference for the content features and their backlog).
- ADMIN only: every `content/...` route has `roleGuard` + `data: { roles: ['ADMIN'] }`, and the "Content" nav item (Manage group) has `roles: ['ADMIN']`.
- `/content` redirects to `/content/articles`. `app-content-nav` (`pages/content/content-nav.component.ts`) is the Articles / Categories tab row under the header of both list pages.
- **Articles** (`pages/content/articles/`, `ArticlesService` → `/api/articles`):
  - The list asks the API for everything: the status filter (`Live`/`Offline`… labels are `content.articles.list.filter.*`, shorter than the enum labels so four fit at 320px), the search (draft title, debounced 300 ms) and 20 rows a page with "Show more". Rows show the draft title and open the editor.
  - "New article" (`/content/articles/new`) asks for a title, because the API creates a draft with one, then opens the editor with `replaceUrl`.
  - The editor (`/content/articles/:id`) is **full screen, outside the shell**: a top-level route after the shell (so the shell's `content/articles/new` matches first) with `authGuard` + `roleGuard` and `canDeactivate: [leaveEditorGuard]`. It lives in its own lazy chunk with Editor.js; keep anything that imports Editor.js out of the route table (that is why the guard is in `leave-editor.guard.ts`).
  - Layout: a top bar (back, save status, Preview, Publish), the title and the body, and a settings panel (status, address, last saved, slug before the first publish, excerpt, categories, featured image, SEO title and description, then the Publishing section) on the right from 1024px, below the text on phones.
  - **Lifecycle** (backlog item 11, `ArticlesService` `publish` / `unpublish` / `discardDraft` / `delete` / `createPreviewToken`):
    - The main button reads Publish (draft), Publish again (unpublished) or Update (published; disabled while the site already shows the draft). It saves what is left first (`autosave.save()`), then publishes that revision; a field with an error or a failed save publishes nothing. A 400's `message` array is listed under the top bar; other errors show as they come. `applyLifecycle()` keeps "unpublished changes" when the draft moved on while publishing.
    - Preview saves first, then opens `${environment.publicSiteUrl}/preview?token=…`. The tab is opened in the click (`window.open('', '_blank')`, `opener` cleared) so it isn't blocked as a pop-up; it gets its address when the token arrives, and is closed on an error.
    - Discard changes (when the draft differs from the site), Unpublish (while published) and Delete permanently (otherwise) sit at the end of the settings panel, each behind `app-confirm-dialog` (`pages/content/confirm-dialog.component.ts`: a modal `<dialog>`, Cancel first and focused; Escape and the backdrop answer no). Discard rebuilds the form and Editor.js from the answer; delete goes back to the list without the leave guard asking.
    - `environment.publicSiteUrl` is `https://theindex.training` in production and `http://localhost:4321` (theindex-web's dev server) in development; it also builds the "View on site" links.
  - **Autosave** (`editor/draft-autosave.ts`): about 2 s after the last change (`AUTOSAVE_DELAY` token), only the changed fields (the body only when `blocksKey()` differs from the last saved blocks: Editor.js also reports changes that leave the text as it was), one request at a time, each with the `baseRevision` the last answer gave. Text is trimmed, empty optional fields go as `null`, and a field over its limit waits with its error (`article-form.ts` has the API's limits) while the rest is saved. A 409 stops it until "Reload the article"; other errors keep the changes for "Try again". Leaving saves first and asks (`window.confirm`) when that fails; `beforeunload` asks while anything is unsaved.
  - **Editor.js** (`editor/block-editor.component.ts`): only the blocks the API accepts. `editor-tools.ts` trims the list tool (no checklists, start numbers or counter types) and the quote tool (no alignment), and has our own image and video tools, which store `{ mediaId, caption }` and `{ service: 'youtube', videoId, caption }` directly (the image comes from the media picker; a video from a pasted YouTube link or the toolbox's link field, with its thumbnail from `i.ytimg.com`). `article-content.ts` maps stored content to the editor's data (the list `meta`) and back; the round trip is lossless. Editor.js's own UI text comes from `content.articles.blocks.*`, and a language switch rebuilds the editor around the current content. Its light-only styles are mapped onto the tokens in `block-editor.component.scss` (`ViewEncapsulation.None`, every rule under `.block-editor`).
  - In unit tests the real Editor.js runs in jsdom once `window.matchMedia` exists (stub it); it watches a new block for edits only after an idle callback and batches its change events for 400 ms. Wait for `requestIdleCallback` before editing, then poll for the save (`HttpTestingController.match()` takes what it returns, so keep it); fixed sleeps fail under the full suite's load. In E2E, wait for `requestIdleCallback` before typing "/" in a new block.
- **Media picker** (`pages/content/media/media-picker.component.ts`, `MediaService` → `/api/media`): a modal `<dialog>` whose `open()` resolves with the chosen image or null. Library (newest first, "Show more", select then "Use this image") or upload (JPEG, PNG or WebP; alt text required, 1–250 characters; the new image is used at once). Used by the featured image and the image block. jsdom has no `showModal()`, so specs stub it.
- **Categories** (`pages/content/categories/`, `ArticleCategoriesService` → `/api/article-categories`): list, create, edit and delete pages. There is no details page: a row opens the edit page, which links to the delete page. Create and edit share `category-form.ts` (validators with the API DTO limits, payload building) and `app-category-fields`.
  - Name 1–60 characters. The slug ("page address", `/articles/category/<slug>` on the site) is optional on create (the API makes it from the name) and required on edit. The order is optional on create (the API puts it last).
  - The API answers 409 for a taken name or slug, and for a slug change while published articles use the category; those messages are shown as they come.

## How this repo relates to theindex-api
- The API serves everything under `/api` (Swagger at `/api/docs` when running locally). Dev: `proxy.conf.json` forwards `/api` to `localhost:3000`. Prod: the nginx image only serves static files plus the SPA fallback; `/api` routing to the API container comes from the `docker compose` setup on the VPS (`/opt/theindex`), which is in neither repo.
- If you need an endpoint or field that doesn't exist, the change belongs in theindex-api first. Keep service interfaces in sync with the API's DTOs/entities, and flag cross-repo changes to the user.

## Design system ("Chalk & Iron")
The app is being redesigned in phases. Phase 1 added tokens, fonts and theming. Phase 2 replaced the header with the navigation shell (sidebar on desktop, tab bar + sheet on mobile). Phase 3 redesigned the Trainees list and extracted the list page pattern below. Phase 4a applied it to the other list pages, 4b covered create/edit/details/delete pages and Register attendance, and 4c covered the trainee-facing pages, auth pages and dashboard. Phase 5 was a consistency pass over the whole app. Every page now uses the design system.

**Direction:** bold and athletic, fitting a CrossFit gym. Condensed uppercase headings, chalk-white (light) or near-black (dark) backgrounds, one red accent taken from the logo, flat surfaces (no gradients), generous touch targets (44px minimum).

### Tokens
All tokens are CSS custom properties defined in `src/styles.scss` (global, so they don't count toward component style budgets). Color tokens have a light and a dark value; the theme is selected by `data-theme="light|dark"` on `<html>`.

| Token | Use for | Light | Dark |
|---|---|---|---|
| `--bg` | page background | `#F2F1EE` | `#0E0E0D` |
| `--surface` | cards, inputs, header | `#FFFFFF` | `#191917` |
| `--surface-2` | subtle fills: table headers, chips, hovers | `#E9E7E1` | `#26261F` |
| `--text` | primary text | `#121211` | `#F2F1EE` |
| `--muted` | secondary text, labels | `#5A5954` | `#A3A19A` |
| `--border` | decorative dividers and card outlines | `#DCD9D2` | `#2D2C29` |
| `--border-strong` | form-control borders (≥3:1 against surface) | `#8A8880` | `#6E6C66` |
| `--accent` | primary buttons, focus rings, active indicators (fills, not text) | `#800000` | `#EE4238` |
| `--on-accent` | text/icons on `--accent` | `#FFFFFF` | `#0E0E0D` |
| `--accent-soft` | tinted backgrounds (selected nav, secondary buttons, badges) | `#F3E3E1` | `#331412` |
| `--accent-text` | accent-colored text and links | `#800000` | `#FF7A70` |
| `--accent-border` | borders on `--accent-soft` elements | `#DCAAA6` | `#6B2420` |
| `--success` / `--success-soft` / `--success-border` | paid, active, linked | `#256B3A` / `#E2F0E5` / `#A9D3B3` | `#7BD69A` / `#16301F` / `#2C5A3A` |
| `--warning` / `--warning-soft` / `--warning-border` | caution notices | `#8A4A00` / `#FBEFD5` / `#EDCB8A` | `#F2BE5C` / `#33270F` / `#5E4718` |
| `--danger` / `--danger-soft` / `--danger-border` | errors, unpaid, destructive actions | `#B42318` / `#FCE8E6` / `#F1B4AC` | `#FF8F84` / `#3A1714` / `#6B2A24` |
| `--on-danger` | text on a solid `--danger` fill | `#FFFFFF` | `#1A0D0B` |
| `--nav-bg` / `--nav-text` / `--nav-text-strong` | the dark "iron" navigation shell (same feel in both themes) | `#121211` / `#B5B3AC` / `#F2F1EE` | `#070707` / `#A3A19A` / `#F2F1EE` |
| `--nav-surface` | hover/active items, tiles and the theme switch track on the nav shell | `#262622` | `#1C1C1A` |
| `--nav-border` | dividers on the nav shell (decorative) | `#3A3934` | `#2D2C29` |
| `--nav-accent` | accent marks on the nav shell: active marker, focus outline. `--accent` is too dark on `--nav-bg` in light mode | `#FF4A3D` | `#FF4A3D` |
| `--scrim` | backdrop behind modal sheets/dialogs | `rgba(18,18,17,.55)` | `rgba(0,0,0,.65)` |
| `--shadow-sm` / `--shadow-md` | card lift / popovers and menus | | |

Pairing rules (all checked at ≥4.5:1 for text):
- Text colors: `--text`, `--muted`, `--accent-text`, `--success`, `--warning`, `--danger` on `--bg`, `--surface`, `--surface-2` or their own `-soft` token.
- Don't use `--accent` for text; it fails 4.5:1 on `--surface-2` in light mode. Use `--accent-text`.
- On a solid `--accent` fill use `--on-accent`; on solid `--danger` use `--on-danger`. Never hard-code `#fff`.
- `--border` is decorative (about 1.4:1). Inputs, selects and other control outlines use `--border-strong`.

Other scales:
- **Spacing** (4px base): `--space-1` 4px, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-6` 24, `-8` 32, `-10` 40, `-12` 48, `-16` 64.
- **Radii:** `--radius-sm` 8px, `--radius-md` 10px (inputs), `--radius-lg` 12px (buttons), `--radius-xl` 16px (cards), `--radius-pill` 999px.
- **Type:** `--text-xs` 12px, `--text-sm` 14, `--text-base` 16, `--text-lg` 18, `--text-xl` 22, `--text-2xl` 28, `--text-3xl` 36, `--text-4xl` fluid 40–56px for page titles. `--heading-tracking` (0.02em) for headings, `--label-tracking` (0.08em) for uppercase labels and buttons.
- **Interaction:** `--touch-target` (44px), `--focus-ring` (box-shadow ring for fields), `--transition-fast`.
- **Control heights:** `--control-height` (3rem) for inputs, selects and form buttons, including `ui-input` and `ui-button`. `--control-height-lg` (3.25rem) for search fields and the page header action.

### Brand
- **Logos** (official artwork, transparent PNG, cropped to the badge, 640×270, about 10 kB each) in `public/brand/`, served at `/brand/…`:
  - `the-index-logo-red.png`: red badge, black lettering. This is the one the app uses, in both themes and on the nav shell. `app-brand` (sidebar, mobile top bar, Not found / Unauthorized) and the Login panel show it.
  - `the-index-logo-grey.png`: grey badge with red speckles. Not used in the UI yet; keep it for places where the red one clashes.
- **Icons:** `public/favicon.ico` (16/32/48) and `public/apple-touch-icon.png` (180, logo on the nav black) are generated from the red logo. There is no square version of the mark yet, so at 16px it reads as the red badge; replace both if one arrives.
- Show the logo as an `<img>` with `width="640" height="270"` (so the space is reserved before it loads) and size it with CSS `height`. Give it an accessible name: `alt="The Index"`, or `alt=""` when the surrounding link already has an `aria-label`, as in `app-brand`.
- **Logo colors:** red `#800000`, lettering black `#000000`, grey `#999999`. The light-theme `--accent` and `--accent-text` are the logo red; the other theme colors are tuned for contrast. Don't redraw the logo in CSS or use these values directly; use the image and the tokens.

### Fonts
- **Sofia Sans Condensed** 600/700 (`--font-heading`): headings, buttons, uppercase labels. Always uppercase with `--heading-tracking` or `--label-tracking`.
- **Sofia Sans** 400/500/600 (`--font-body`): everything else.
- Both need full Cyrillic. The app used Barlow / Barlow Condensed until the i18n work, but Google Fonts serves them without Cyrillic, so Bulgarian fell back to a system serif. Sofia Sans keeps the condensed, DIN-like look (its Latin is very close to Barlow) and was designed in Sofia: its lowercase Cyrillic uses the Bulgarian letterforms (in both UI languages, so Bulgarian names look the same everywhere). Any replacement font must have Cyrillic; check the `cyrillic` subset on Google Fonts.
- Loaded from Google Fonts in `src/index.html` with `display=swap`. The production build inlines the font CSS (`optimization.fonts`), so `npm run build` needs network access to fonts.googleapis.com.

### Base styles (in `src/styles.scss`)
- `h1`–`h6` use the heading font, uppercase, 700/600 weight. `a` uses `--accent-text`.
- `input`, `select` and `textarea` get surface background, `--border-strong` border, `--radius-md` and a 44px min height. Checkboxes and radios use `accent-color: var(--accent)`.
- Every `button` has a 44px min height. Style buttons and button-like links with `.btn` variants; the old per-page `.button` classes are gone.
- Focus: `:focus-visible` gets a 2px `--accent` outline with a 2px offset. Fields use `border-color: var(--accent)` plus `box-shadow: var(--focus-ring)`. Don't remove focus styles without replacing them.
- Shared form components `components/ui-button` and `ui-input` are already built on the tokens. Prefer them to one-off styles. Checkboxes use the `.form-field--check` pattern; there is no checkbox component.

### Theming
- `ThemeService` (`services/theme.service.ts`) has three modes: `light`, `dark`, `system`. The default is `system`, which follows `prefers-color-scheme` and reacts live to OS changes. It exposes `mode()` and `resolvedTheme()` signals plus `setMode()` and `cycleMode()`. Explicit choices are stored in `localStorage` under `theme`; choosing `system` clears the key.
- An inline script in `src/index.html` applies the theme before Angular boots, so the wrong theme never flashes. If you change the storage key or mode values, update both places.
- Because the theme depends on an attribute set at runtime, critical-CSS inlining is turned off in `angular.json` (`optimization.styles.inlineCritical: false`). With it on, only the light tokens would be inlined, and dark mode would flash light. Keep `styles.scss` small, since it is render-blocking.
- `ThemeSwitchComponent` (`components/theme-switch`) is the Light / Dark / Auto segmented control, built from native radios so arrow keys work. It lives in the sidebar footer and the mobile sheet, and is styled for the nav shell.
- `LanguageSwitchComponent` (`components/language-switch`) is the БГ / EN control built the same way. It sits under the theme switch in the sidebar footer, in its own "Language" section of the mobile sheet, and (with `[compact]="true"`) in the top-right corner of the Login brand panel.

### Navigation shell (`components/main-layout`)
- **Data:** `components/navigation/navigation.ts`. Item labels are translation keys (`nav.*`). `buildNavigation(role)` returns the sidebar items (`main`, `manage`), the mobile `tabs`, the sheet items (`moreMain`, `moreManage`) and the sheet's label. To add a page to the nav, add a `NavItem` there (with `roles` if it is restricted) and an `icon`. It is covered by `navigation.spec.ts`. Role filtering only shapes the UI; routes still need `roleGuard` + `data.roles`.
- **Desktop (≥ 1024px):** `app-sidebar`, a sticky `--nav-bg` column with brand, main items, the "Manage" group, theme and language switches and `app-user-block`. The active item gets `--nav-surface` plus a small `--nav-accent` marker, and `aria-current="page"` via `routerLinkActive` + `ariaCurrentWhenActive`.
- **Mobile (< 1024px):** a compact sticky top bar with `app-brand`, plus `app-tab-bar`, fixed to the bottom and padded for `env(safe-area-inset-*)` (`viewport-fit=cover` is set in `index.html`).
  - Staff tabs: Home, Trainees, Register (accent square, the primary action), Settle, More.
  - Trainees: Profile, Stats, Records, Account. They have no primary action, so no accent tab.
  - The last tab opens `app-nav-sheet`, a native `<dialog>` opened with `showModal()`. It contains the remaining items as tiles, the theme and language switches and account actions. It gets focus containment and Escape for free, closes on backdrop tap, on navigation and when the window grows to desktop, and returns focus to the tab. The More/Account tab shows as active when the current page lives in the sheet.
  - Page content gets bottom padding for the tab bar, so it never ends up underneath it.
- The breakpoint is in two places: `main-layout.component.scss` and `DESKTOP_QUERY` in `main-layout.component.ts`.
- **Icons:** `app-icon` renders inline Lucide-style SVG strokes (24px grid, 2px round strokes, `currentColor`, `aria-hidden`). Size them with `--icon-size`. To add an icon, add a name to `IconName` and an `@case` with the path data. Don't use icon fonts or emoji.
- **Accessibility:**
  - A "Skip to content" button is the first tab stop and focuses `<main>`. It is a button because `href="#…"` would navigate with `<base href="/">`.
  - Nav landmarks are labelled "Main"; only one is rendered per breakpoint.
  - Focus outlines on the nav shell use `--nav-accent`.
- **Global helpers in `styles.scss`:**
  - `.visually-hidden` hides content visually but keeps it for screen readers.
  - `html:has(dialog[open])` locks page scroll while a modal dialog is open.

### List page pattern (reference: `pages/trainees/trainees.component.*`)
Every list page follows the Trainees page; phase 4a applied it to Plans, Gyms, Gym subscriptions, Trainers, Training times, Attendance history, Settlements and Cash register. Copy its template structure:

```html
<section class="page-stack">
  <app-page-header title="Plans" subtitle="One line about the page." [action]="{ label: 'New plan', link: '/plans/new' }" />

  <div class="list-toolbar">
    <app-search-field class="list-toolbar__search" label="Search plans" [value]="term" (valueChange)="term = $event; applySearch()" />
    <app-segmented-control label="Status" [options]="statusOptions" [value]="filter" (valueChange)="filter = $event; load()" />
    <p class="list-toolbar__count" aria-live="polite">{{ shown }} of {{ total }} plans</p>
  </div>

  @if (loading) { <app-skeleton-list label="Loading plans" /> }
  @else if (errorMessage) { <app-empty-state tone="danger" title="Couldn't load plans" [message]="errorMessage"> <button class="btn btn--secondary" (click)="load()">Try again</button> </app-empty-state> }
  @else if (!items.length) { <app-empty-state icon="…" title="No plans yet" message="…"> <a class="btn btn--primary" routerLink="/plans/new">New plan</a> </app-empty-state> }
  @else if (!filtered.length) { <app-empty-state title="No matches" …> <button class="btn btn--secondary" …>Clear search</button> </app-empty-state> }
  @else {
    <div class="data-table-wrap responsive-table" tabindex="0" role="region" aria-label="Plans table"> <table class="data-table">…</table> </div>
    <ul class="list-card responsive-list" aria-label="Plans"> <li><app-list-row …/></li> </ul>
  }
</section>
```
- **Breakpoints:** at 768px and up, show the table. Below 768px, show the `list-card` of `app-list-row`s. The global `.responsive-table` / `.responsive-list` classes do the toggling, so list pages usually need no SCSS of their own. The create action is a header button at 1024px and up, and a floating "+" below that, where the tab bar shows.
- **Data:** keep loading and filtering in the page component; these pieces are presentational only. A segmented filter that maps to an API param keeps calling the existing load method.
- **Only the controls a page already has:** don't add search or filters while restyling. Plans has a status filter but no search, and Training times has neither.
- **Rows with their own actions** (delete, an inline link) can't be an `app-list-row`, which is a single link:
  - A link row plus one button: `li.row-with-action` holding the `app-list-row` and an `.icon-btn`. Example: settlements with delete.
  - Anything richer: `li.record` with `.record__main` and `.record__aside`. Examples: attendees and transactions.
- **Destructive row actions:** an `.icon-btn.icon-btn--danger` with an `aria-label` that names the item, e.g. "Delete settlement 2026-10-01 to 2026-10-31".
- **Errors after something is already loaded** (e.g. a failed delete): show a `.notice.notice--danger` above the list instead of replacing it.
- **States:** there are always four:
  - loading → `app-skeleton-list`
  - error → `app-empty-state tone="danger"` with "Try again"
  - empty → `app-empty-state` with the create action, or "Show all" when a filter caused it
  - no search matches → `app-empty-state` with "Clear search"
  - Hide the count when nothing is loaded.

**Components** (all standalone in `components/`, presentational, built on tokens):

| Component | Use |
|---|---|
| `app-page-header` | `title`, `subtitle`, optional `back: { label, link }` (a "← Back to …" link above the title) and optional `action: { label, link }`. It renders the desktop button and the mobile FAB. With a FAB, `<main>` gets `--fab-clearance` bottom room via a global rule, so the last row isn't covered. |
| `app-search-field` | Search input with icon and its own 44px clear button (the native one is hidden). Takes `label` (visually hidden, required) and `placeholder`; use `[value]` + `(valueChange)`. |
| `app-segmented-control` | Single choice built on native radios (announced as a group, arrow keys work). Takes `label` (legend, required), `options: SegmentedOption[]`, `[value]` + `(valueChange)`. |
| `app-chip` | Uppercase label. `tone`: `accent` (e.g. gym card), `neutral` (e.g. Inactive), `success`, `warning`, `danger`. |
| `app-avatar` | Initials (first + last word) in a rounded square. Takes `name` and `muted`; size with `--avatar-size`. It is decorative, so always show the name as text. |
| `app-status-dot` | Dot + text label. `tone`: `success`, `warning`, `danger`, `neutral`. The text carries the meaning. |
| `app-list-row` | Mobile row; the whole row is one link. Inputs: `link`, `title`, `titleSuffix` (muted), `avatarName`, `dimmed`. Slots: `[listRowMeta]` for the second line and `[listRowTrailing]` for a chip. Dimmed rows use `--muted` text instead of opacity, so contrast stays ≥4.5:1. |
| `app-empty-state` | Icon, title, message, and actions in the default slot. `tone="danger"` uses the alert icon and `role="alert"`. |
| `app-ranked-list` | Top-N card (Stats): `title`, `subtitle`, `items: { label, value }[]`, `unit`. It shows rank, label and count, plus a proportional bar that is `aria-hidden`. |
| `app-skeleton-list` | Loading placeholder rows (`rows`, `label`). Announces `label` through `role="status"`; the blocks are `aria-hidden`. |
| `app-trainee-trainings` | A trainee's trainings section (My profile and trainee details): heading (`heading`, `subheading`, `headingId`), a Calendar / List switch and the chosen view. Calendar is the default; an explicit choice is stored in `localStorage` under `trainingsView`. |
| `app-trainings-calendar` | Home-made month grid of trainings (no calendar library): weeks Monday first, days keyed by local date (`utils/calendar.util.ts`). From 768px a cell lists time, trainer and gym; below that, a marker per training. Paid = green dot (`--success`), unpaid = red diamond (`--danger`), explained in a legend. Selecting a day lists it below the grid; with none selected, phones list the whole month there. The day buttons are one tab stop with arrow/Home/End/PageUp/PageDown keys. |

**Global classes** (in `styles.scss`, shared without per-component budget):
- **Page layout:** `.page-stack` stacks a page vertically. `.list-toolbar` and its `__search`/`__count` children form the toolbar row.
- **`.data-table-wrap` + `.data-table`:**
  - The wrap is a card that scrolls horizontally inside itself. Give it `tabindex="0"`, `role="region"` and an `aria-label`.
  - It is `position: relative` on purpose. Without that, `.visually-hidden` header text escapes the scroll clip and widens the whole page.
  - Use `th scope="col"`, a visually-hidden `<caption>`, and `.cell-fit` for shrink-to-fit columns.
  - Row link pattern: the name cell holds the real link. A trailing chevron link may duplicate it for the mouse with `tabindex="-1"` and `aria-hidden="true"`, so keyboard and screen-reader users get one link per row.
- **`.list-card`:** the bordered `<ul>` for `app-list-row`s.
- **Tables:**
  - `.responsive-table` / `.responsive-list` switch between table and list at 768px.
  - `.data-table .cell-link` is the row's primary link.
  - `.row-chevron` is the mouse-only duplicate link.
  - `.row-actions` groups trailing buttons.
  - `.cell-right` right-aligns numeric columns; put it on both the `th` and the `td`.
  - `.person-cell` (with `__text` and `__sub`) is the avatar + name + nickname cell.
  - `.linked-mark` is the success-colored "Linked" / "✓ App".
- **Mobile rows that aren't one link:** `.record` (with `__main`, `__title`, `__meta`, `__aside`) and `li.row-with-action`. An `a.record__title` is styled as a title link, so don't add per-page link classes.
- **`.panel` + `.panel__title`:** card section for forms, summaries and grouped content.
- **`.stats` > `.stat`** (with `__label` and `__value`): key-figure tiles. A `<dl>` with `dt`/`dd` works too.
- **Forms:**
  - `.form-grid` stacks rows. A `.form-row` holds the 1–3 fields that belong together (Name + Nickname, Start + End, Plan type + Credits + Price) and splits the width evenly from 768px up; on phones every field gets its own line. Pick rows deliberately, in reading order; don't rely on auto-wrapping. A checkbox (`.form-field--check`) gets its own row, placed directly in `.form-grid`.
  - A field is `div.form-field` with `label.form-field__label[for]`, the control (`id`, `aria-describedby="<id>-help"`, `[attr.aria-invalid]`), then **either** `.form-field__error` (when touched and invalid) **or** `.form-field__hint` (otherwise), both with `id="<id>-help"`. Use `@if … } @else {` so the hint never shows next to an error that says the same thing.
  - Required is the default and is not marked. Optional fields end the label with `<span class="form-field__optional">(optional)</span>`.
  - Any rule beyond "required" (length, number range, decimals, format) gets a hint stating the expected format, e.g. "2–100 characters.", "Whole number, 1 or more.", "0 or more, up to two decimals, e.g. 45.50." Take the limits from the API DTOs and enforce the same ones client-side; `utils/form-validators.util.ts` has `trimmedLength(min, max)` for text that gets trimmed before sending.
  - Invalid fields (`[aria-invalid='true']`) get a `--danger` border automatically. `app-ui-input` takes `describedBy` and `invalid` for the same wiring.
  - `.form-actions` holds the buttons, least important first and primary last. Below 768px they stack full width with the primary on top.
- **Form and detail layout:**
  - Form pages use the full content width. `.page-narrow` caps detail and delete pages at 60rem.
  - `.detail-list` holds label/value pairs.
  - `.form-field--check` is a checkbox row.
  - `.password-field` + `.password-toggle` is a password input with a show/hide button.
  - `.form-stack` is a vertical form layout.
  - `.panel-section` is a titled section inside a panel.
  - `.section-header` is a page section's heading row.
- **`.solo-page` + `.solo-card`** (with `__code`, `__title` and `__text`): a full-page centered card for routes outside the app shell, such as Not found and Unauthorized. Wrap it in `<main>`, as Login does, so the page has a landmark.
- **`.notice`** with `--success` / `--warning` / `--danger`: inline banners. Use `role="status"` for success and `role="alert"` for errors.
- **`.toggle-chip`:** multi-select chip on a `<button aria-pressed>`, e.g. picking attendance sessions.
- **`.icon-btn`** (and `--danger`): 44px icon-only button. It always needs an `aria-label`.
- **Text helpers:** `.num` (tabular numbers, no wrap), `.text-muted`, `.text-success`, `.text-danger`.
- **`.skeleton`:** pulsing placeholder block.
- **`.btn`** + `.btn--primary` / `.btn--secondary` / `.btn--ghost` (low emphasis) / `.btn--danger` (soft) / `.btn--danger-solid` (confirming a destructive action): link or button actions in page content. `ui-button` stays the full-width form button.

**Icons** available in `app-icon`: home, users, check, history, wallet, banknote, clipboard, dumbbell, ticket, trainer, clock, user, chart, trophy, more, settings, key, log-out, close, search, chevron-left, chevron-right, plus, alert, trash, arrow-left, eye, eye-off, file-text, renew, chevron-up, chevron-down, timer.

### Form and detail page pattern (reference: `pages/plans/plan-*.component.html`)
Create, edit, details and delete pages share one structure. They need no page SCSS. Create/edit pages drop `page-narrow` and use the full width:

```html
<section class="page-stack">
  <app-page-header title="Edit plan" subtitle="…" [back]="{ label: 'Back to plans', link: '/plans' }" />
  @if (loading) { <p class="notice" role="status">Loading plan...</p> }
  @else if (errorMessage && !plan) { <p class="notice notice--danger" role="alert">{{ errorMessage }}</p> }
  @else {
    <form class="panel" [formGroup]="form" (ngSubmit)="handleSubmit()">
      <div class="form-grid">
        <div class="form-row">
          <div class="form-field">
            <label class="form-field__label" for="plan-price">Price (EUR)</label>
            <input id="plan-price" type="number" formControlName="price" aria-describedby="plan-price-help" [attr.aria-invalid]="…invalid" />
            @if (…invalid) { <span class="form-field__error" id="plan-price-help">Enter a price of 0 or more, with up to two decimals.</span> }
            @else { <span class="form-field__hint" id="plan-price-help">0 or more, up to two decimals, e.g. 45.50.</span> }
          </div>
          <div class="form-field">
            <label class="form-field__label" for="plan-notes">Notes <span class="form-field__optional">(optional)</span></label>
            <input id="plan-notes" formControlName="notes" />
          </div>
        </div>
        <label class="form-field form-field--check"><input type="checkbox" formControlName="isActive" /><span>Active plan</span></label>
      </div>
      @if (errorMessage) { <p class="notice notice--danger" role="alert">{{ errorMessage }}</p> }
      <div class="form-actions"><button class="btn btn--primary" type="submit">Save plan</button></div>
    </form>
  }
</section>
```
- **Details pages:**
  - Use a `.panel` containing a `<dl class="detail-list">`, with `<div><dt>Label</dt><dd>Value</dd></div>` pairs. Status uses `app-status-dot`.
  - Extra sections inside the panel go in `section.panel-section` with an `h2.panel__title`.
  - Actions sit in `.form-actions`: least important first and primary last.
  - With only edit and deactivate: Deactivate (`btn--ghost`), then Edit (`btn--primary`).
  - With an account: Deactivate (`btn--ghost`), Edit (`btn--secondary`), then Manage account (`btn--primary`).
- **Delete/deactivate pages:**
  - The panel holds a `detail-list`, a `.notice.notice--warning` explaining the consequence, and a `btn--danger-solid` confirm button.
  - Secondary destructive actions on other pages (e.g. "Deactivate account" next to Save) use the soft `btn--danger`.
- **Password inputs:**
  - Use `app-ui-input type="password"` (Login, Change password), or `.password-field` with an icon `button.password-toggle` in plain reactive forms.
  - The button shows the `eye` / `eye-off` icon, has an `aria-label` of "Show password" or "Hide password", and must stay keyboard reachable, so no `tabindex="-1"`.
- **Detail pages with tables** (e.g. trainee details):
  - Put each table in its own `section.page-stack` with a `.section-header` (title, muted line and an optional control such as a segmented filter), instead of nesting the table card inside a panel.
- **Register attendance** (`pages/attendance/attendance-register`) is the phone-first exception:
  - Compact session fields.
  - Full-width tappable trainee rows (a `label` around a real checkbox; `.is-selected` adds the accent tint and a left bar).
  - A sticky save bar that sits above the tab bar on mobile and at the bottom of the viewport on desktop.
  - Keep it usable one-handed when changing it.
- **Behaviour:** when restyling a form, keep `formControlName`s, validators, button labels' meaning and submit flow exactly as they were. The phase 4 PRs verified this by diffing every API request body against the previous build.

### Rules for components
- **Text length:** Bulgarian runs about 20–40% longer than English and the condensed uppercase style makes it wider still. Check new UI in both languages at 320px and 1280px. Tab labels shrink fluidly (`clamp`) and the segmented control's options shrink on phones; table headers and nav labels must stay short (`nav.*` labels can differ from the page titles, e.g. "Присъствия" vs "История на присъствията").
- **Use tokens, never hard-coded colors.** No hex, `rgb()`, named colors or gradients in component SCSS. If a token is missing, add it to both themes in `src/styles.scss` and document it here; don't inline a value.
- Check a new pairing in both themes, at 4.5:1 for text and 3:1 for UI component boundaries.
- Use the spacing, radius, type and control-height tokens for new styles instead of new magic numbers.
- Only the system breakpoints: 768px (table ↔ list, form actions) and 1024px (sidebar ↔ tab bar).
- Interactive elements must be at least 44px tall or wide.
- On the nav shell (`--nav-bg`), use the `--nav-*` tokens, not the page tokens.
- Component styles budget is 4kB warn / 8kB error per component. Share patterns through global styles or shared components rather than copying them.

## Internationalization
Bulgarian is the default language; English is the second. Users switch at runtime (БГ / EN), with no reload and no per-locale build. **All user-facing text goes through translation keys; add every key to both `public/i18n/bg.json` and `public/i18n/en.json`.** That covers headings, labels, buttons, placeholders, hints, validation messages, empty/loading/error states, confirm dialogs, `aria-label`s, table captions and route titles.

- **Library:** Transloco (`@jsverse/transloco`), configured in `i18n/i18n.providers.ts` (`provideI18n()`), plus `@jsverse/transloco-messageformat` for ICU syntax. Don't use `@angular/localize`; it needs a build per locale.
- **Files:** `public/i18n/<lang>.json`, nested by feature: `common`, `nav`, `enums`, `accounts`, `subscriptions`, `trainings`, then one namespace per page folder (`trainees`, `plans`, `attendance`, `settlements`, `cashRegister`, …), each split into `list` / `create` / `edit` / `details` / `delete` / `fields` / `errors`. Reuse `common.*` for generic words (Status, Try again, Saving..., (optional)).
- **Loading and cache-busting:** `BundledTranslationLoader` imports the JSON through the bundler, so each file becomes a content-hashed lazy chunk and a deploy can never serve stale text. That is why `angular.json` excludes `public/i18n` from the copied assets. The app initializer waits for the active language, so the first render is already translated.
- **LanguageService** (`i18n/language.service.ts`) mirrors ThemeService: `lang()` signal, `setLanguage()`, `toggle()`, `use()` (switch without saving), `t(key, params)`. Default `bg` whatever the browser language; an explicit choice is stored in `localStorage` under `lang`. It loads a language before switching, then updates Transloco, the signal and `<html lang>` together. The inline script in `src/index.html` sets `<html lang>` before boot; keep the key and values in sync with it.
- **Templates:** `{{ 'trainees.list.loading' | transloco }}`, `[title]="'nav.trainees' | transloco"`, params `'trainees.list.noMatches' | transloco: { term }`. Inputs of shared components take translated text, except `SegmentedOption.label`, `NavItem.label`/`tabLabel`, the trainee tables' `emptyKey` and `app-ranked-list`'s `countKey`, which take keys.
- **Component code:** use `LanguageService.t()` for text that a template helper returns (it reads the language signal, so the view updates on a switch) and for `window.confirm`. Don't store translated strings for later display: store a `UiMessage` (`i18nMessage(key)` or `apiErrorMessage(error, fallbackKey)`) and render it with `| uiMessage`, so it follows a language switch.
- **Plurals:** ICU, e.g. `"{count, plural, one {# трениращ} other {# трениращи}}"`. Bulgarian needs only `one`/`other`; counted masculine nouns take the counted form ("5 плана", "3 реда"). Use typographic quotes: „…“ in Bulgarian (`common.quoted`), “…” in English. Literal `{`, `}` must be quoted per ICU rules.
- **Enums:** never show raw API values (ACTIVE, PUNCH, PAID…). Add the value to `ENUM_VALUES` in `i18n/enum-labels.ts` and to `enums.<group>` in both files, then use `{{ value | enumLabel: 'planType' }}`.
- **Dates, numbers, money:** use `LocaleFormatService` (`date`, `dateTime`, `shortDate`, `time`, `clock`, `weekday`, `number`, `money` from cents). It uses Angular locale data for `bg` and `en-GB` (registered in `provideI18n()`) and re-renders on a switch. Don't use `Intl.*`, `toLocaleString()` or the `date`/`currency` pipes with a fixed locale.
- **API messages** come from theindex-api in English and are shown as is; only the frontend fallbacks are translated.
- **Glossary (Bulgarian):** trainee трениращ, trainer треньор, plan план, subscription абонамент, gym зала, gym subscription спортна карта, training time час за тренировка, training тренировка, attendance присъствие, register attendance отбележи присъствие, settlement разчет, cash register каса, nickname прякор, account акаунт, profile профил, dashboard табло, credits (punch plans) посещения. Keep these consistent.
- **Tests:** `i18n/i18n-keys.spec.ts` fails if the two files' keys differ, a key used in `src/app` (any quoted `namespace.key` string) is missing, an enum label is missing, an ICU message doesn't compile, or placeholders differ between languages. Build keys with `${}` only where unavoidable (enums); those can't be checked statically.

## Rules
- **Don't modify `.github/workflows/` (deploy pipeline), `Dockerfile` (nginx config) or `proxy.conf.json` without asking first.** `docker-ghcr.yml` runs, on every PR and push to `main`, a `lint` job (`lint:check`, `format:check`, `typecheck:e2e`), a `test-and-build` job (unit tests and the production build) and an `e2e` job (the journeys). On `main` only, once all three pass, it builds the image, pushes it to GHCR and redeploys the production VPS over SSH (same layout as theindex-api, whose `lint` job gates its deploy the same way).
- Don't push to `main`; work on a branch and open a PR.
- Follow the existing patterns: standalone components, lazy routes in `app.routes.ts` with `roleGuard` + `data.roles`, one service per resource, `@if`/`@for` in templates, SCSS per component.
- Stay within the production budgets in `angular.json` (initial 500kB warn / 1MB error; component styles 4kB warn / 8kB error).
- Never hardcode API hosts. Always go through `environment.apiUrl`.
- Never hardcode colors. Use the design tokens (see "Design system").
- Never hardcode user-facing text. Use translation keys in both language files (see "Internationalization").
- Run `npm run build`, `npm run lint:check`, `npm run format:check` and `npx ng test --watch=false` before pushing (plus `npm run typecheck:e2e` when `e2e/` changed). Keep reformat-only changes out of unrelated PRs.
- Tests follow "Testing (characterization tests)" above: current behavior is the spec, and production code changes only for `data-testid`s.
- Use the new control flow (`@if`, `@for`) in templates, not `*ngIf` / `*ngFor`.
