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

Known baseline (as of Oct 2026): build passes with no warnings and all `ng test` specs pass. Keep it that way; a failing spec is a regression.

## Folder structure
```
src/
  main.ts, index.html (fonts + pre-boot theme script), styles.scss (design tokens + base styles)
  environments/           # environment.ts / environment.development.ts (apiUrl: '/api'), imported as '@environments/environment'
  app/
    app.config.ts         # provideHttpClient(withInterceptors([authInterceptor])), provideRouter
    app.routes.ts         # all routes; role restrictions via data: { roles: [...] } + roleGuard
    pages/<feature>/      # one folder per feature: list, -create, -edit, -details, -delete components
    components/           # shared UI: navigation shell (main-layout, sidebar, tab-bar, nav-sheet, brand, theme-switch, user-block, icon, navigation.ts), list page pieces (page-header, search-field, segmented-control, chip, avatar, status-dot, list-row, empty-state, skeleton-list), ui-button/input/checkbox, trainee tables
    services/             # one service per API resource + auth.service, auth.interceptor, theme.service
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

## Design system ("Chalk & Iron")
The app is being redesigned in phases. Phase 1 added tokens, fonts and theming. Phase 2 replaced the header with the navigation shell (sidebar on desktop, tab bar + sheet on mobile). Phase 3 redesigned the Trainees list and extracted the list page pattern below; phase 4 applies it to the other list pages.

**Direction:** bold and athletic, fitting a CrossFit gym. Condensed uppercase headings, chalk-white (light) or near-black (dark) backgrounds, one orange accent, flat surfaces (no gradients), generous touch targets (44px minimum).

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
| `--accent` | primary buttons, focus rings, active indicators (fills, not text) | `#C2410C` | `#FF7A33` |
| `--on-accent` | text/icons on `--accent` | `#FFFFFF` | `#141210` |
| `--accent-soft` | tinted backgrounds (selected nav, secondary buttons, badges) | `#FBE4D6` | `#3B1F10` |
| `--accent-text` | accent-colored text and links | `#9A3412` | `#FFA36B` |
| `--accent-border` | borders on `--accent-soft` elements | `#F3BC98` | `#6A3416` |
| `--success` / `--success-soft` / `--success-border` | paid, active, linked | `#256B3A` / `#E2F0E5` / `#A9D3B3` | `#7BD69A` / `#16301F` / `#2C5A3A` |
| `--warning` / `--warning-soft` / `--warning-border` | caution notices | `#8A4A00` / `#FBEFD5` / `#EDCB8A` | `#F2BE5C` / `#33270F` / `#5E4718` |
| `--danger` / `--danger-soft` / `--danger-border` | errors, unpaid, destructive actions | `#B42318` / `#FCE8E6` / `#F1B4AC` | `#FF8F84` / `#3A1714` / `#6B2A24` |
| `--on-danger` | text on a solid `--danger` fill | `#FFFFFF` | `#1A0D0B` |
| `--nav-bg` / `--nav-text` / `--nav-text-strong` | the dark "iron" navigation shell (same feel in both themes) | `#121211` / `#B5B3AC` / `#F2F1EE` | `#070707` / `#A3A19A` / `#F2F1EE` |
| `--nav-surface` | hover/active items, tiles and the theme switch track on the nav shell | `#262622` | `#1C1C1A` |
| `--nav-border` | dividers on the nav shell (decorative) | `#3A3934` | `#2D2C29` |
| `--nav-accent` | accent marks on the nav shell: active marker, focus outline. `--accent` is too dark on `--nav-bg` in light mode | `#FF7A33` | `#FF7A33` |
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

### Fonts
- **Barlow Condensed** 600/700 (`--font-heading`): headings, buttons, uppercase labels. Always uppercase with `--heading-tracking` or `--label-tracking`.
- **Barlow** 400/500/600 (`--font-body`): everything else.
- Loaded from Google Fonts in `src/index.html` with `display=swap`. The production build inlines the font CSS (`optimization.fonts`), so `npm run build` needs network access to fonts.googleapis.com.

### Base styles (in `src/styles.scss`)
- `h1`–`h6` use the heading font, uppercase, 700/600 weight. `a` uses `--accent-text`.
- `input`, `select` and `textarea` get surface background, `--border-strong` border, `--radius-md` and a 44px min height. Checkboxes and radios use `accent-color: var(--accent)`.
- Every `button` and `.button` has a 44px min height. `.button` is also `inline-flex` and centered.
- Focus: `:focus-visible` gets a 2px `--accent` outline with a 2px offset. Fields use `border-color: var(--accent)` plus `box-shadow: var(--focus-ring)`. Don't remove focus styles without replacing them.
- Shared components in `components/ui-button`, `ui-input` and `ui-checkbox` are already built on the tokens. Prefer them to one-off styles.

### Theming
- `ThemeService` (`services/theme.service.ts`) has three modes: `light`, `dark`, `system`. The default is `system`, which follows `prefers-color-scheme` and reacts live to OS changes. It exposes `mode()` and `resolvedTheme()` signals plus `setMode()` and `cycleMode()`. Explicit choices are stored in `localStorage` under `theme`; choosing `system` clears the key.
- An inline script in `src/index.html` applies the theme before Angular boots, so the wrong theme never flashes. If you change the storage key or mode values, update both places.
- Because the theme depends on an attribute set at runtime, critical-CSS inlining is turned off in `angular.json` (`optimization.styles.inlineCritical: false`). With it on, only the light tokens would be inlined, and dark mode would flash light. Keep `styles.scss` small, since it is render-blocking.
- `ThemeSwitchComponent` (`components/theme-switch`) is the Light / Dark / Auto segmented control, built from native radios so arrow keys work. It lives in the sidebar footer and the mobile sheet, and is styled for the nav shell.

### Navigation shell (`components/main-layout`)
- **Data:** `components/navigation/navigation.ts`. `buildNavigation(role)` returns the sidebar items (`main`, `manage`), the mobile `tabs`, the sheet items (`moreMain`, `moreManage`) and the sheet's label. To add a page to the nav, add a `NavItem` there (with `roles` if it is restricted) and an `icon`. It is covered by `navigation.spec.ts`. Role filtering only shapes the UI; routes still need `roleGuard` + `data.roles`.
- **Desktop (≥ 1024px):** `app-sidebar`, a sticky `--nav-bg` column with brand, main items, the "Manage" group, theme switch and `app-user-block`. The active item gets `--nav-surface` plus a small `--nav-accent` marker, and `aria-current="page"` via `routerLinkActive` + `ariaCurrentWhenActive`.
- **Mobile (< 1024px):** a compact sticky top bar with `app-brand`, plus `app-tab-bar`, fixed to the bottom and padded for `env(safe-area-inset-*)` (`viewport-fit=cover` is set in `index.html`).
  - Staff tabs: Home, Trainees, Register (accent square, the primary action), Settle, More.
  - Trainees: Profile, Stats, Records, Account. They have no primary action, so no accent tab.
  - The last tab opens `app-nav-sheet`, a native `<dialog>` opened with `showModal()`. It contains the remaining items as tiles, the theme switch and account actions. It gets focus containment and Escape for free, closes on backdrop tap, on navigation and when the window grows to desktop, and returns focus to the tab. The More/Account tab shows as active when the current page lives in the sheet.
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
Every list page (plans, gyms, trainers, settlements, …) follows the Trainees page. Copy its template structure:

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
    <div class="data-table-wrap plans-table" tabindex="0" role="region" aria-label="Plans table"> <table class="data-table">…</table> </div>
    <ul class="list-card plans-list" aria-label="Plans"> <li><app-list-row …/></li> </ul>
  }
</section>
```
- **Breakpoints:** at 768px and up, show the table. Below 768px, show the `list-card` of `app-list-row`s; toggle them with `display` in the page SCSS (see `trainees.component.scss`). The create action is a header button at 1024px and up, and a floating "+" below that, where the tab bar shows.
- **Data:** keep loading and filtering in the page component; these pieces are presentational only. A segmented filter that maps to an API param keeps calling the existing load method.
- **States:** there are always four:
  - loading → `app-skeleton-list`
  - error → `app-empty-state tone="danger"` with "Try again"
  - empty → `app-empty-state` with the create action, or "Show all" when a filter caused it
  - no search matches → `app-empty-state` with "Clear search"
  - Hide the count when nothing is loaded.

**Components** (all standalone in `components/`, presentational, built on tokens):

| Component | Use |
|---|---|
| `app-page-header` | `title`, `subtitle`, optional `action: { label, link }`. It renders the desktop button and the mobile FAB. With a FAB, `<main>` gets `--fab-clearance` bottom room via a global rule, so the last row isn't covered. |
| `app-search-field` | Search input with icon and its own 44px clear button (the native one is hidden). Takes `label` (visually hidden, required) and `placeholder`; use `[value]` + `(valueChange)`. |
| `app-segmented-control` | Single choice built on native radios (announced as a group, arrow keys work). Takes `label` (legend, required), `options: SegmentedOption[]`, `[value]` + `(valueChange)`. |
| `app-chip` | Uppercase label. `tone`: `accent` (e.g. gym card), `neutral` (e.g. Inactive), `success`, `warning`, `danger`. |
| `app-avatar` | Initials (first + last word) in a rounded square. Takes `name` and `muted`; size with `--avatar-size`. It is decorative, so always show the name as text. |
| `app-status-dot` | Dot + text label. `tone`: `success`, `warning`, `danger`, `neutral`. The text carries the meaning. |
| `app-list-row` | Mobile row; the whole row is one link. Inputs: `link`, `title`, `titleSuffix` (muted), `avatarName`, `dimmed`. Slots: `[listRowMeta]` for the second line and `[listRowTrailing]` for a chip. Dimmed rows use `--muted` text instead of opacity, so contrast stays ≥4.5:1. |
| `app-empty-state` | Icon, title, message, and actions in the default slot. `tone="danger"` uses the alert icon and `role="alert"`. |
| `app-skeleton-list` | Loading placeholder rows (`rows`, `label`). Announces `label` through `role="status"`; the blocks are `aria-hidden`. |

**Global classes** (in `styles.scss`, shared without per-component budget):
- **Page layout:** `.page-stack` stacks a page vertically. `.list-toolbar` and its `__search`/`__count` children form the toolbar row.
- **`.data-table-wrap` + `.data-table`:**
  - The wrap is a card that scrolls horizontally inside itself. Give it `tabindex="0"`, `role="region"` and an `aria-label`.
  - It is `position: relative` on purpose. Without that, `.visually-hidden` header text escapes the scroll clip and widens the whole page.
  - Use `th scope="col"`, a visually-hidden `<caption>`, and `.cell-fit` for shrink-to-fit columns.
  - Row link pattern: the name cell holds the real link. A trailing chevron link may duplicate it for the mouse with `tabindex="-1"` and `aria-hidden="true"`, so keyboard and screen-reader users get one link per row.
- **`.list-card`:** the bordered `<ul>` for `app-list-row`s.
- **`.skeleton`:** pulsing placeholder block.
- **`.btn` + `.btn--primary` / `.btn--secondary`:** link or button actions in page content. `ui-button` stays the full-width form button.

**Icons** available in `app-icon`: home, users, check, history, wallet, banknote, clipboard, dumbbell, ticket, trainer, clock, user, chart, trophy, more, settings, key, log-out, close, search, chevron-right, plus, alert.

### Rules for components
- **Use tokens, never hard-coded colors.** No hex, `rgb()`, named colors or gradients in component SCSS. If a token is missing, add it to both themes in `src/styles.scss` and document it here; don't inline a value.
- Check a new pairing in both themes, at 4.5:1 for text and 3:1 for UI component boundaries.
- Use the spacing, radius and type tokens for new styles instead of new magic numbers.
- Interactive elements must be at least 44px tall or wide.
- On the nav shell (`--nav-bg`), use the `--nav-*` tokens, not the page tokens.
- Component styles budget is 4kB warn / 8kB error per component. Share patterns through global styles or shared components rather than copying them.

## Rules
- **Don't modify `.github/workflows/` (deploy pipeline), `Dockerfile` (nginx config) or `proxy.conf.json` without asking first.** Every push to `main` builds the image, pushes it to GHCR and redeploys the production VPS over SSH.
- Don't push to `main`; work on a branch and open a PR.
- Follow the existing patterns: standalone components, lazy routes in `app.routes.ts` with `roleGuard` + `data.roles`, one service per resource, `@if`/`@for` in templates, SCSS per component.
- Stay within the production budgets in `angular.json` (initial 500kB warn / 1MB error; component styles 4kB warn / 8kB error).
- Never hardcode API hosts. Always go through `environment.apiUrl`.
- Never hardcode colors. Use the design tokens (see "Design system").
- Run `npm run build` and `npx ng test --watch=false` before pushing.
