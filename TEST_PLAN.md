# Test plan: characterization tests for theindex-front

Rules are in `CLAUDE.md` → "Testing". In short:
- Current production behavior is the spec.
- Mock only at boundaries.
- Every test must fail when its behavior breaks.
- Anything that looks wrong is pinned with `// CHARACTERIZATION: possibly unintended` and logged in `TEST_NOTES.md`.

**Baseline (2 Nov 2026):** 13 spec files and 47 tests, all passing (`npx ng test --watch=false`). There are no E2E tests and Playwright is not a dependency yet.

**Risk levels** (unit tests are ordered by them; modules are listed highest risk first):
- **P0:** access control, sessions, money, and anything that writes attendance, subscriptions, settlements or cash. A bug here loses money or data, or exposes screens to the wrong role.
- **P1:** workflow logic: request parameters, payload shaping, defaults, selection, and error and empty handling.
- **P2:** display helpers and formatting.

**Checkboxes:**
- `[ ]` to do.
- `[x]` done and merged.
- `[~]` covered only by an existing spec that is too weak to count. It stays open until strengthened.

---

## 0. Ground rules for writing these specs

The review below turned up a few traps. Every spec should follow these.

- **Zoneless app.** After `HttpTestingController.flush()`, call `await fixture.whenStable()` before reading the DOM. Many pages update fields in HTTP callbacks without `detectChanges()`, so the field and the DOM can disagree (see S1 below). Assert what the user sees. Where the DOM is stale, assert both the stale DOM and the field, and mark the test CHARACTERIZATION.
- **Real collaborators.** Use the real services, interceptor, router and Transloco (from `src/test-providers.ts`, English). For navigation, use `provideRouter([{ path: '**', children: [] }])` and assert `TestBed.inject(Router).url`. Don't spy on `navigate`.
- **Auth state** comes from a shared `src/testing/jwt.ts` helper. It holds `makeToken({ sub, role, email, trainerProfileId, traineeProfileId })` and `signInAs(role, claims?)`, which writes `localStorage.accessToken`. `localStorage.clear()` runs in `beforeEach`.
- **Shared helpers in `src/testing/`** get type-checked by the production build: `tsconfig.app.json` includes `src/**/*.ts` and excludes only `*.spec.ts`. So they must be plain TypeScript with no `vi`/`describe` globals and no app imports. Anything that needs Vitest stays inside the spec files.
- **Time:** `vi.useFakeTimers({ now: new Date('2026-11-02T00:30:00+02:00') })` and similar. Pick instants where local time and UTC fall on different dates, so date defaults are actually tested. Tests run under the machine's TZ; pin `TZ=Europe/Sofia` for the date specs, either in the npm script or by asserting against values computed the same way. Decide this once in the first date spec and record the choice here.
- **Private validators** (the plan, trainee-details and cash-register `currencyValidator`s, and `integerValidator`) aren't exported. Exporting them would change production code, so test them through the form controls of the component that owns them.
- **Table-driven specs** for the near-identical CRUD pages (§7) instead of twenty copy-pasted files. Each row must still fail on its own when that page breaks.
- **Spec files are not scanned by `i18n-keys.spec.ts`,** so specs may use key strings freely.

---

## Part A — Unit tests

### 1. Access control and session (P0)

**`services/auth.service.ts` → `auth.service.spec.ts`**
- [ ] `login()` POSTs `/api/auth/login` with `{ email, password }` exactly as given, untrimmed. On success it stores `accessToken` under `localStorage.accessToken`.
- [ ] `login()` stores nothing when the request fails, and the error reaches the subscriber.
- [ ] `logout()` removes only `accessToken`; `theme` and `lang` survive.
- [ ] `isAuthenticated()` is true for any non-empty stored string, including a malformed token and a token whose `exp` is in the past. There is no expiry check. CHARACTERIZATION, see S6.
- [ ] Claim getters (`getUserRole`, `getAccountId`/`sub`, `getTrainerProfileId`, `getTraineeProfileId`):
  - return the claim, or `null` when it is missing or explicitly `null`;
  - return `null` with no token;
  - return `null` for a token without a payload segment, with invalid base64, or with invalid JSON (never throw).
- [ ] Decoding handles base64url (`-`, `_`) and missing `=` padding, using a payload crafted to contain both.
- [ ] `getUserEmail()` returns `email`, falls back to `sub`, then `null`.

**`services/auth.interceptor.ts` → `auth.interceptor.spec.ts`** (real `HttpClient` with `withInterceptors([authInterceptor])`)
- [ ] With a token: the request carries `Authorization: Bearer <token>`. Without one: no `Authorization` header.
- [ ] The token is read per request: log in, and the next request carries the new token.
- [ ] 401 with a token stored: the token is removed, the router ends at `/login`, and the original error still reaches the caller.
- [ ] 401 without a token (e.g. a wrong-password login): the token is untouched, there is no navigation, and the error is rethrown.
- [ ] 403, 500 and status 0: the token is kept and there is no navigation.

**`guards/*.ts` → one spec per guard, using `TestBed.runInInjectionContext`**
- [ ] `authGuard`: no token → `UrlTree('/login')`; any token → `true`.
- [ ] `loginGuard`: no token → `true`; `TRAINEE` → `/my-profile`; `ADMIN`, `TRAINER`, an unknown role or an undecodable token → `/home`.
- [ ] `roleGuard`:
  - no token → `/login`;
  - no `data.roles` or an empty list → `true`;
  - role allowed → `true`;
  - `TRAINEE` not allowed → `/my-profile`;
  - `TRAINER` not allowed, or no role → `/unauthorized`.

**`app.routes.ts` → `app.routes.spec.ts`** (route config is access control, so it gets pinned)
- [ ] Table test over the flattened route tree. Every path has exactly the documented `roleGuard` + `data.roles`:
  - ADMIN only: `trainers/**`, `settlements/new`, `cash-register`;
  - TRAINEE only: `my-profile`, `stats`, `records`;
  - `change-password`: authenticated users of any role, with no `roleGuard`;
  - everything else under the shell: ADMIN + TRAINER;
  - the shell itself has `authGuard`, and `login` has `loginGuard`.
- [ ] A new route without a row in the table fails the test.
- [ ] Integration with `RouterTestingHarness` and the real routes (lazy components load):
  - `/` → `/login`;
  - signed-in staff at `/` → `/home`;
  - `/plans/new` resolves to the create page, not to details with id `new` (order matters);
  - an unknown URL → the not-found page;
  - the document title is "<page> · The Index" (see §10).

### 2. Sign-in and password change (P0)

**`pages/login/login.component.ts` → `login.component.spec.ts`**
- [ ] Empty submit sends no request and shows both field errors. A password shorter than 3 characters shows the length error.
- [ ] Success with a token without `sub`: no password-status call; it navigates to `/home` (staff) or `/my-profile` (trainee).
- [ ] Success with `sub`: GET `/api/accounts/<sub>/password-status`.
  - `true` → the default route by role;
  - `false` → `/change-password`;
  - an HTTP error → the default route.
- [ ] Login error:
  - shows the API `message` (a string, or an array joined with ", ");
  - falls back to `auth.login.error` when there is no usable message;
  - the button is enabled again;
  - no token is stored.

**`pages/change-password/change-password.component.ts` → `change-password.component.spec.ts`**
- [ ] On init with an account: GET password-status.
  - `false` → the phone field appears and is required;
  - `true` → no phone field;
  - error → no phone field and loading ends.
- [ ] No `sub` in the token: no request. Submit shows `auth.changePassword.noAccount` and sends nothing.
- [ ] Validation:
  - each password field needs 8 or more characters;
  - mismatched new and confirm show `mismatch` only on the confirm field;
  - the error getters return '' until the field is touched.
- [ ] Phone required but blank or whitespace: the phone is marked touched and no request is sent.
- [ ] Payload: `{ currentPassword, newPassword, confirmPassword }`, plus `phone` (trimmed) only when it is required.
- [ ] Success: the form resets and the app navigates by role. `successMessage` is set but the page navigates away at once, so it is never seen. CHARACTERIZATION, see S5.
- [ ] Error: the API message or the `auth.changePassword.error` fallback; the button is enabled again.

### 3. Money: subscriptions, plans, cash (P0)

**`pages/trainees/trainee-details.component.ts`, selling a subscription** (the spec covers the whole page; this part first)
- [ ] Plans load from `GET /api/plans?active=true`. The first plan is preselected and **Paid** is prefilled with its price in euros (`4550` cents → `45.5`).
- [ ] Changing the plan re-fills **Paid** from that plan's price, overwriting a manual edit.
- [ ] Paid validation:
  - blank fails required;
  - negative is invalid;
  - three decimals is invalid;
  - `45.50` is valid;
  - `0.1 + 0.2`-style floats round correctly (`0.3` → `30` cents).
- [ ] Submit POSTs `/api/trainees/<id>/subscriptions` with `{ planId, startsAt, paidCents }`.
- [ ] The default `startsAt` comes from `new Date().toISOString().slice(0,10)`, which is the **UTC** date. At 00:30 Sofia time it pins yesterday's date. CHARACTERIZATION, see S2.
- [ ] After success:
  - the subscription list is fetched again;
  - **Paid** resets to the chosen plan's price;
  - `startsAt` resets to today (UTC);
  - the plan stays selected.
- [ ] Error: `subscriptionErrorMessage` is set and `submitting` is reset, but the DOM is not updated (no `detectChanges`). CHARACTERIZATION, see S1.

**`pages/plans/plan-create.component.ts` / `plan-edit.component.ts`**
- [ ] Price → `priceCents` via `Math.round(price*100)`, including a float edge case.
- [ ] Type PUNCH: credits required, ≥ 1 and an integer; duration has no validators and is cleared.
- [ ] Type TIME: the reverse.
- [ ] Switching type clears the other field's value.
- [ ] Create payload: `{ type, title (trimmed), priceCents, isActive }` plus `credits` (PUNCH) or `durationDays` (TIME). The other key is absent.
- [ ] Edit payload: the same, but always sends both keys, the unused one as `null`.
- [ ] Edit: patches the form from GET `/api/plans/<id>`, prices shown in euros (`toEuros`).
- [ ] The title has only `Validators.required`, so whitespace-only passes and is sent as `''`. CHARACTERIZATION, see S7.
- [ ] Success → `/plans`. Error → the field is set but the DOM is stale. CHARACTERIZATION, see S1.

**`pages/cash-register/cash-register.component.ts`**
- [ ] Load: GET `/api/cash-register` shows the balance and transactions. Error → the danger state with "Try again", which reloads.
- [ ] Amount:
  - `0` and negative values fail `min(0.01)`;
  - three decimals fail;
  - `12.34` → `amountCents: 1234`.
- [ ] Payload `{ direction, amountCents, notes? }`: notes are trimmed, and whitespace-only notes are omitted (`notes` absent from the JSON body).
- [ ] A second submit while one is in flight is ignored (exactly one request).
- [ ] Success:
  - the form resets to IN / 0 / '', untouched;
  - the `cashRegister.created` notice shows;
  - the state is reloaded (second GET).
- [ ] Error: the `formErrorMessage` notice; the form keeps its values.
- [ ] `formatTransactionDetails` (P2):
  - SETTLEMENT with a period, and without one;
  - SUBSCRIPTION with buyer, plan and type parts joined by " • ", and with no parts;
  - any other type → `-`;
  - `sourceDetails` null → `-`.
- [ ] `formatTransactionType` (P2): a known enum is translated; an unknown `SOME_NEW_TYPE` becomes "Some New Type".
- [ ] Buyer label "Name (nick)" or `unknownTrainee`. The buyer link goes to `/trainees/<id>`, or `/trainees` when there is no id.

### 4. Attendance (P0)

**`pages/attendance/attendance-register.component.ts`**
- [ ] On init: exactly four GETs.
  - `/api/trainers?active=true`
  - `/api/gym-locations?includeInactive=false`
  - `/api/training-times`
  - `/api/trainees?active=true`
- [ ] Inactive items in the responses are still filtered out on the client.
- [ ] Training times are sorted by start time ("08:00" before "18:30", whatever order the API sends).
- [ ] Preselection:
  - the signed-in trainer's `trainerProfileId` when it is in the list, otherwise the first trainer;
  - the first gym;
  - the date is today in **local** time (contrast with S2).
- [ ] Search is case-insensitive over name or nickname. "Select shown" and "Clear shown" affect only the filtered trainees. Selections survive filter changes.
- [ ] Submit with an invalid form: no request, fields touched.
- [ ] Submit with no trainee selected: `attendance.register.selectAtLeastOne` and no request.
- [ ] Payload `POST /api/attendance/batch`: `{ trainerId, locationId, traineeIds, trainedDate }`, plus `trainedTime` as `HH:mm` only when a time is picked ("Not specified" omits the key).
- [ ] Success → `/attendance`.
- [ ] Error → the API message is shown in the DOM (this page does call `detectChanges`); the selection is kept.
- [ ] Load error → `attendance.register.loadError`.

**`pages/attendance/attendance-sessions.component.ts`**
- [ ] Default range: from 7 days ago to today, local dates (fake clock).
- [ ] ADMIN:
  - loads `/api/trainers?active=true`;
  - `trainerId` is sent only when a trainer is picked;
  - `startTime` and `endTime` are sent only when set.
- [ ] TRAINER:
  - no trainers request;
  - `trainerId` is always their own profile id;
  - a trainer token without `trainerProfileId` sends no `trainerId`, so it sees every trainer's sessions. CHARACTERIZATION, see S9.
- [ ] Session selection after a load:
  - keys still present stay selected;
  - if none remain, all sessions are selected;
  - no sessions → none selected;
  - `toggleSession` adds and removes keys.
- [ ] Summary over the selected sessions: sessions, attendance, paid and unpaid come from `totals`; `finalPriceCents` sums only `price.isFinal` items.
- [ ] Price helpers: `attendancePrice` gives '—' when the price isn't final; `sessionTotalPrice` sums final prices only.
- [ ] `canDeleteSessionAttendance`: ADMIN can delete in any session; TRAINER only in sessions with their own `trainerId`.
- [ ] Delete:
  - `window.confirm` gets the translated text with name, date and time; cancel → no request;
  - OK → `DELETE /api/attendance/<id>`, the row is removed locally and `totals` are recomputed from the remaining items;
  - a second delete while one is in flight is ignored;
  - error → message.
- [ ] Label helpers:
  - trainer is "Name (nick)" or "Name", or '—' when unknown;
  - the tab title uses the nickname, falling back to the name;
  - trainee and location fall back to '—'.

### 5. Trainees and accounts (P1)

**`pages/trainees/trainees.component.ts`** (extends the existing spec, which covers display helpers only)
- [ ] The filter maps to the request: All → no `active` param; Active → `active=true`; Inactive → `active=false`.
- [ ] Gym cards load from `/api/gym-subscriptions?includeInactive=true`. A failure falls back to `[]`, and the list still renders.
- [ ] Search is client-side, trimmed, case-insensitive, over name or nickname. Changing the filter keeps the term applied. `TraineesService.list` supports `search`, but the page never sends it.
- [ ] The count shows shown / total. "Clear search" restores all rows.
- [x] Nickname quoting, gym card lookup, trailing chip (existing spec).

**`trainee-create` / `trainee-edit`**
- [ ] Validation: name required and 2–100 trimmed; nickname optional, 1–50 trimmed.
- [ ] Create payload: `{ name (trimmed), nickname|null, phone|null, gymSubscriptionId, isActive: true }`. Blank optional fields become `null`.
- [ ] Create loads gym cards with `GET /api/gym-subscriptions` (no `includeInactive`); edit loads them with `includeInactive=true`.
- [ ] Edit patches the form from GET. Its payload has no `isActive`.
- [ ] Success → `/trainees`. Error → stale DOM. CHARACTERIZATION, see S1.

**`trainee-details`** (beyond §3)
- [ ] On init: four parallel GETs (`/api/trainees/<id>`, `…/subscriptions`, `/api/attendance/trainees/<id>`, `/api/plans?active=true`), plus `GET /api/accounts/<accountId>` when the trainee is linked. An account error → no account section.
- [ ] `canDeleteSubscriptions` is true for ADMIN and TRAINER (any other role can't reach the page).
- [ ] The subscription filter defaults to ACTIVE. The status match ignores case. Each filter has its own empty-message key.
- [ ] Deleting a subscription:
  - confirm text includes the plan and start date; cancel → no request;
  - `DELETE /api/subscriptions/<id>` removes it locally;
  - a second delete is blocked while one is in flight;
  - error → message.
- [ ] A plans load error is written into `subscriptionErrorMessage`, the same slot as subscription errors.
- [ ] A subscription whose plan isn't in the active-plans list shows the raw `planId` as its name. CHARACTERIZATION, see S3.
- [ ] `formatPlanOption`: "Title · Punch card · €45.00".

**`trainee-delete`**
- [ ] Shows the details with linked/not-linked status. Confirm → `DELETE /api/trainees/<id>` → `/trainees`. Error → stale DOM (S1).

**`trainee-account` and `trainer-account`** (the same code with a different role; one table-driven spec)
- [ ] Profile without `accountId` → create mode. Password and confirm are required; the validator returns `passwordLength` for fewer than 8 characters and `passwordsMismatch` otherwise.
- [ ] Create payload `POST /api/accounts/{trainee|trainer}/<profileId>`: `{ email (trimmed), role: 'TRAINEE'|'TRAINER', status: 'ACTIVE', password, confirmPassword }`.
- [ ] Profile with `accountId` → `GET /api/accounts/<accountId>`, then edit mode with the email prefilled. A blank password is allowed and omitted from the PATCH; a filled one sends both password fields.
- [ ] The account GET fails, or returns `null`, while the profile has `accountId`: the page falls back to create mode, and submitting would provision a second account. CHARACTERIZATION, see S8.
- [ ] Deactivate: `DELETE /api/accounts/<accountId>` → back to the profile details. A second click while in flight is ignored. There is no confirm dialog (record as behavior).
- [ ] Success → `/trainees/<id>` or `/trainers/<id>`. Errors → the API message or the create/update/deactivate fallback keys, shown in the DOM (these handlers call `detectChanges`).

### 6. Settlements (P1, money-adjacent)

**`settlements.component.ts`**
- [ ] `canManageSettlements` only for ADMIN. For a TRAINER the generate action is hidden, the delete buttons are hidden, and `deleteSettlement()` is a no-op.
- [ ] Delete:
  - confirm text with the period; cancel → no request;
  - `DELETE /api/settlements/<id>` → removed locally;
  - error → the list stays, with a danger notice above it;
  - a second delete while one is in flight is ignored.

**`settlement-generate.component.ts`**
- [ ] Both dates default to local today (fake clock).
- [ ] An empty date → `missingDates` and no request.
- [ ] No start ≤ end check: the request goes out and the API decides. CHARACTERIZATION, see S11.
- [ ] `POST /api/settlements {periodStart, periodEnd}` → `/settlements/<response.settlement.id>`. Error → message.

**`settlement-details.component.ts`**
- [ ] On init:
  - `GET /api/settlements/<id>`;
  - `GET …/allocations?offset=0&limit=500`;
  - `GET /api/trainers`, `GET /api/trainees` (no params);
  - `GET /api/gym-locations?includeInactive=true`.
- [ ] The admin trainer filter re-requests allocations with `trainerId`; "All" omits it.
- [ ] Allocations are capped at 500 with no paging; the page shows "N of total". CHARACTERIZATION, see S10.
- [ ] Finalize is visible and works only for ADMIN on a DRAFT settlement: `POST …/finalize` with `{}`, the status updates and the button disappears. Error → message. `finalizeSettlement()` is a no-op for a TRAINER or a FINAL settlement.
- [ ] Labels:
  - trainer = trimmed nickname or name;
  - trainee = "Name (nick)";
  - gym name;
  - each falls back to the raw id;
  - a missing id → '—';
  - a failed entity request falls back silently.

### 7. Catalog CRUD family (P1): plans, gyms, gym subscriptions, training times, trainers

One table-driven spec per page type (`crud-details.spec.ts`, `crud-forms.spec.ts`, `crud-delete.spec.ts`), with one row per resource. Every row checks:
- [ ] details / edit / delete: a missing `:id` → that resource's `errors.missingId` and no request. A load error → the API message or `errors.load`. A loaded record is shown (details) or patched into the form (edit).
- [ ] create / edit: an invalid form sends nothing and marks fields touched. The payload is exactly as listed below. Success → the list URL. Error → the field is set but the DOM is stale (S1).
- [ ] delete/deactivate: `DELETE /api/<resource>/<id>` → the list URL. Error → stale DOM (S1).

| Resource | Create/edit payload and validators | List request and filter |
|---|---|---|
| Plans | see §3 | All → no param, Active → `active=true`, Inactive → `active=false` |
| Gyms | `{ name (2–120 trimmed), address (optional, 2–250, blank → null) }`; no notes, no isActive | All/Inactive → `includeInactive=true`, Active → `includeInactive=false`; Inactive also filters `!isActive` on the client |
| Gym subscriptions | `{ name (2–120 trimmed) }` | as Gyms |
| Training times | `{ startTime, endTime }`, both required; no end > start check (S12) | no filter; times shown as `HH:mm` |
| Trainers | create `{ name (2–100), nickname|null (1–50), isActive: true }`; edit without isActive | filter as Plans plus client-side search as Trainees |

- [ ] Plans list `formatPlanDetails`: PUNCH → "10 visits" (ICU), TIME → "30 days". A null count shows 0.
- [ ] Trainers list: search, count, nickname label (mirrors §5).

### 8. Dashboards (P1)

**`pages/home/home.component.ts`** (replaces the existing "should create" spec, which is `[~]`)
- [~] Existing spec only checks that the component is created.
- [ ] Reports load only for ADMIN or TRAINER: `GET /api/attendance/reports/inactive-trainees?skipDays=7` and `GET …/reports/without-active-subscription`.
- [ ] Changing "Inactive for" to 30 sends `skipDays=30`. Each report has its own loading, error and empty states.
- [ ] Changing the selection twice quickly: responses aren't cancelled, so a late response for 7 days can overwrite the 30-day result. CHARACTERIZATION, see S4.
- [ ] `traineeDisplayName`: "Name (nick)", a trimmed name, or `home.reports.unknown`.
- [ ] `formatSubscriptionSummary` (P2):
  - `null` → '—';
  - parts in order, joined by " • ";
  - `remainingTrainings: 0` is included (it only skips `null`);
  - an unknown plan type is passed through;
  - no parts → '—'.

**`pages/trainee-dashboard/trainee-dashboard.component.ts`**
- [ ] No `traineeProfileId` in the token: `traineeDashboard.missingProfile` and no requests.
- [ ] Three parallel GETs: `/api/attendance/trainees/<id>`, `/api/trainees/<id>/subscriptions`, `/api/plans` (no `active` param, unlike trainee details).
- [ ] If any of the three fails, every section shows the same error.
- [ ] The filter defaults to ACTIVE. Each filter's empty key and the case-insensitive match are checked.

**`pages/stats/stats.component.ts`**
- [ ] `GET /api/trainees/me/training-insights` maps into the five ranked lists.
- [ ] A weekday label comes from `weekdayNumber` in the active language (7 → Sunday / Неделя). Number 0 or missing → the API's `weekday` string.
- [ ] Error → API message or fallback.

### 9. Navigation shell (P1)

- [x] `buildNavigation` / `isUrlInItems` (existing `navigation.spec.ts`; it already fails on role leaks).
- [ ] `MainLayoutComponent.isSheetPageActive()` follows `router.url` after a `NavigationEnd`. Navigation closes an open sheet.
- [ ] `UserBlockComponent`:
  - initials are the first two alphanumerics of the email, upper-cased, or `U`;
  - Log out removes the token and the router ends at `/login`;
  - the role label is translated.
- The nav sheet's open, close, Escape, backdrop and focus return need a real `<dialog>`, and jsdom has no `showModal()`. They are covered in E2E J8 instead of stubbing the dialog.

### 10. i18n and formatting (P1/P2)

- [ ] `apiErrorMessage`:
  - a string message → `{text}`;
  - whitespace-only → fallback;
  - a string array → joined with ", ";
  - an empty array, a number, a missing body or a `null` error → `{key, params}`.
- [ ] `UiMessagePipe`: `null` → ''; `{text}` is passed through; `{key}` is translated and re-translated after `LanguageService.use('bg')`.
- [ ] `EnumLabelPipe`: a known value is translated (lower-case input works); an unknown value is shown raw; empty → ''; the label follows a language switch.
- [ ] `enumLabelKey` / `isKnownEnum` are case-insensitive.
- [ ] `TranslatedTitleStrategy`: "<page> · The Index"; just "The Index" for a route without a title; re-titles on a language switch.
- [ ] `BundledTranslationLoader`: `en` → the English file; `bg` or any other value → Bulgarian.
- [x] `LanguageService` default / switch / restore / toggle / plurals (existing).
- [ ] `LanguageService.setLanguage` when `localStorage.setItem` throws: it still switches.
- [x] `LocaleFormatService` money, dates, date-only values without a timezone shift, fallbacks (existing).
- [ ] `LocaleFormatService`: `dateTime`, `clock` (leading zero), `weekday(7)`, `number` with `digitsInfo`, and `money` for negative values.
- [x] `ThemeService` (existing).
- [ ] `ThemeService` when storage throws: reading falls back to `system`, and `setMode` still applies the theme.
- [x] Translation file consistency (`i18n-keys.spec.ts`, existing).

### 11. Services: HTTP contract (P1)

One spec per service, each method asserting method, URL, query and body. These pin the hand-written API contract.
- [ ] `buildHttpParams`: drops `undefined`, `null` and `''`; keeps `false` → `'false'` and `0` → `'0'`. The status filters depend on this.
- [ ] `PlansService.list()` sends no param; `list(true)` / `list(false)` send `active=`. CRUD URLs; `deactivate` is DELETE.
- [ ] `GymLocationsService` and `GymSubscriptionsService`: `includeInactive` param; CRUD.
- [ ] `TraineesService`: `list(active, search)` params; `getMyTrainingInsights` → `/api/trainees/me/training-insights`.
- [ ] `TrainersService` and `TrainingTimesService`: CRUD. Training times have `delete` (DELETE, typed `{ deleted: boolean }`) where the others have `deactivate`.
- [ ] `SubscriptionsService`: list and create under `/api/trainees/<id>/subscriptions`; delete is `/api/subscriptions/<id>`.
- [ ] `AttendanceService`:
  - `sessions` params (optional ones dropped);
  - `createBatch`;
  - `deleteById`;
  - trainee lists (`/trainees/<id>`, `/paid`, `/unpaid`);
  - the two report URLs and `skipDays`.
- [ ] `SettlementsService`: `finalize` POSTs `{}`; `allocations` params; `delete`.
- [ ] `CashRegisterService`: state GET; manual POST to `/transactions/manual`.
- [ ] `AccountProvisioningService`: `/api/accounts/{trainer|trainee}/<profileId>` and by-id GET, PATCH, DELETE.
- [ ] `AccountSecurityService`: `hasChangedPassword` maps the response to its boolean; `changePassword` URL and body.
- [x] `ApiService.health` via `app.component.spec.ts` (GET `/api/health` on startup).

### 12. Utilities and shared components with logic (P2)

- [ ] `formatTimeWithoutSeconds`: `'18:30:00'` → `'18:30'`; `'8:5'` → `'08:05'`; `'1830'` is returned unchanged.
- [ ] `displayValue`: trims; `null`, `''` or whitespace → '—'; custom fallback.
- [x] `trimmedLength` (existing).
- [ ] `TraineeSubscriptionsTableComponent`:
  - the plan title falls back to `planId`;
  - TIME → end date;
  - PUNCH → "used of total", where `used = max(initial − remaining, 0)` and nulls count as 0;
  - `statusTone` ACTIVE → success, EXHAUSTED → danger, otherwise neutral, case-insensitive;
  - the delete button renders only when both `showActionsColumn` and `canDeleteSubscriptions` are set, is disabled while that row is deleting, and emits the subscription.
- [ ] `TraineeTrainingsTableComponent`: trainer is nickname or name, or '—'; location name or '—'.
- [ ] `UiInputComponent` (it is a form control, so it has logic):
  - `writeValue(null)` → '';
  - input calls `onChange`; blur calls `onTouched`;
  - `setDisabledState`;
  - the password toggle flips the input type and the button's accessible name.
- [ ] `SearchFieldComponent`: input emits the value; Clear emits '' and refocuses the input.
- [x] `AvatarComponent` initials, `RankedListComponent`, `SegmentedControlComponent` (existing).
- [~] `AppComponent` "should create" adds nothing; the health-check test covers it.
- Not unit-tested (presentational, covered by the pages and E2E): brand, chip, icon, status-dot, skeleton-list, empty-state, page-header, list-row, ui-button, sidebar, tab-bar, theme-switch, language-switch, not-found, unauthorized, records.

---

## Part B — E2E user journeys (Playwright)

### B0. Setup (do this first, in its own PR)

- [ ] Add `@playwright/test` (a dev dependency), `playwright.config.ts` and `e2e/`.
  - `webServer`: `ng serve` on :4200.
  - Projects:
    - `desktop`: Chromium, 1280×800;
    - `mobile`: Chromium, 390×844, touch.
  - Journeys say which projects they run in.
- [ ] **API strategy:** mock at the network boundary with `page.route('**/api/**')`.
  - A small `ApiMock` holds fixtures shaped like theindex-api DTOs.
  - It **records every request** (method, URL, query, JSON body) so tests can assert the calls listed below.
  - It **fails the test on any unmocked `/api` call**.
  - Why: CI-friendly, deterministic, and doesn't need the sibling repo and Postgres. The risk is fixture drift from the real API. It is mitigated by an optional `@real-api` smoke tag that runs J1 against a local theindex-api (seeded `admin`/`admin`); see "Open questions".
- [ ] **Clock:** `page.clock.setFixedTime('2026-11-02T10:00:00+02:00')`, with `timezoneId: 'Europe/Sofia'` in the config. Journeys that check date defaults pin it.
- [ ] **Auth helpers:**
  - `loginViaUi(role)` is used by J1 only;
  - every other journey uses `signInAs(page, role, claims)`, which seeds `localStorage.accessToken` with a fake JWT through `addInitScript`.
- [ ] **Language:**
  - default fixture: seed `localStorage.lang='en'`;
  - `t(key, params?)` reads `public/i18n/en.json` and formats ICU, so selectors use `getByRole('button', { name: t('plans.create.submit') })` and not literal text;
  - J8 also runs one check in Bulgarian, using `bg.json`.
- [ ] **Dialogs:** handle `window.confirm` with `page.once('dialog')`. Assert the message and accept or dismiss.
- [ ] **`data-testid`s to add** (the only allowed production change; add them in the setup PR):
  - `cash-register-balance` (the balance value);
  - `attendance-summary-sessions`, `-attendance`, `-paid`, `-unpaid`, `-total` (summary values);
  - `list-count` on each `.list-toolbar__count`;
  - `settlement-status` (the status value on the details page).
  - Everything else is reachable by role, label or accessible name. Recheck while writing each journey and extend this list rather than using a CSS selector.
- [ ] `npm run e2e` script. Wiring it into CI means editing `.github/workflows/`, which needs the owner's approval first (CLAUDE.md rule).

Every journey starts with `GET /api/health` on boot. It is mocked as `{status:'ok'}` and not repeated below.

### J1. Staff sign-in with forced first password change (P0) [desktop, mobile]
1. Open `/`. The app redirects to `/login`.
2. Submit empty. Field errors show and no request is sent.
3. Wrong credentials: `POST /api/auth/login` → 401 `{message:'Invalid credentials'}`. The alert shows the API message, the app stays on `/login`, and no token is stored. A 401 without a token must not trigger the logout redirect.
4. Correct credentials: `POST /api/auth/login {email,password}` → `{accessToken}` with an ADMIN JWT carrying `sub`.
5. `GET /api/accounts/<sub>/password-status` → `{hasUpdatedInitialPassword:false}` → the app lands on `/change-password`.
6. The page calls `GET /api/accounts/<sub>/password-status` again. The phone field is shown and required.
7. Submit with mismatched passwords: the error shows and no request is sent. Fix it and add a phone.
8. `POST /api/accounts/<sub>/change-password {currentPassword,newPassword,confirmPassword,phone}` → the app lands on `/home`.
9. Home loads `GET /api/attendance/reports/inactive-trainees?skipDays=7` and `GET /api/attendance/reports/without-active-subscription`. The report rows render.
10. Variant: password-status `true` → straight to `/home`. A TRAINEE token → `/my-profile` (its calls are listed in J8).

### J2. Access control and session expiry (P0) [desktop]
1. No token, deep link `/trainees` → `/login`. No `/api/trainees` call.
2. TRAINER token:
   - the sidebar has no Trainers and no Cash register;
   - `/trainers` → `/unauthorized`, and so do `/cash-register` and `/settlements/new`;
   - `/settlements` loads with no generate action.
3. TRAINEE token: `/home` → `/my-profile`, and `/trainees` → `/my-profile`.
4. Any token, `/login` → the role's home (`loginGuard`).
5. Session expiry: an ADMIN on `/trainees` gets `GET /api/trainees` → 401.
   - The token is removed and the app is on `/login`.
   - Reload stays on `/login`.
6. Log out from the user block → `/login`, token gone. Browser Back → still `/login` (`authGuard`).
7. Characterization: a token with a past `exp` is let in, and the first API 401 logs the user out (S6).

### J3. Register attendance as a trainer on a phone (P0) [mobile, plus a desktop smoke run]
1. TRAINER token with `trainerProfileId=T1`. Tap the primary "Register" tab.
2. The page calls:
   - `GET /api/trainers?active=true`
   - `GET /api/gym-locations?includeInactive=false`
   - `GET /api/training-times`
   - `GET /api/trainees?active=true`
3. The trainer select shows T1, the gym select the first gym, and the date `2026-11-02`. Times are listed in start order.
4. Save with nobody selected: the "select at least one" alert shows and there is no POST.
5. Search "iv": only matching trainees are listed. Check two. Clear the search; both are still checked. Check a third. "Clear shown" with a filter active unchecks only the filtered ones; re-check them.
6. Pick the 18:00 training time (option label "18:00 - 19:00"; select it by value `18:00`, not by label). Save.
7. `POST /api/attendance/batch` with `{trainerId:'T1', locationId:<gym1>, traineeIds:[3 ids], trainedDate:'2026-11-02', trainedTime:'18:00'}` → the app lands on `/attendance`.
8. History loads `GET /api/attendance/sessions?startDate=2026-10-26&endDate=2026-11-02&trainerId=T1`.
9. Variant: the batch POST → 400 `{message:[…]}`. The joined message shows, the app stays on the page, and the selection is kept.

### J4. Review and correct attendance history (P0) [desktop, plus a mobile list check]
1. ADMIN token, `/attendance` → `GET /api/trainers?active=true` and `GET /api/attendance/sessions?startDate=…&endDate=…`, with no `trainerId`.
2. Every session chip is pressed (`aria-pressed=true`). The summary testids show the totals over all sessions; the price total counts final prices only.
3. Unpress one session: the summary updates. Unpress all, then press "Apply": the page reloads, and all sessions are selected again.
4. Pick a trainer and press "Apply" → the same request plus `&trainerId=…`.
5. Delete an attendee:
   - the confirm text names the trainee;
   - dismiss → no DELETE;
   - accept → `DELETE /api/attendance/<id>`, the row disappears, and the session and summary counts drop.
6. Same page as a TRAINER (`trainerProfileId=T1`):
   - no trainer filter;
   - the request always has `trainerId=T1`;
   - delete buttons appear only in T1's sessions (the fixture also contains another trainer's session).

### J5. New trainee: profile → subscription → app account (P0) [desktop]
1. ADMIN token. `/trainees` → `GET /api/trainees` (filter All, so no param) and `GET /api/gym-subscriptions?includeInactive=true`.
2. "New trainee" → `GET /api/gym-subscriptions`.
   - Submit empty: errors, no POST.
   - Fill name "  Ivan Petrov ", nickname blank, a gym card.
   - Save → `POST /api/trainees {name:'Ivan Petrov', nickname:null, phone:null, gymSubscriptionId, isActive:true}` → back on `/trainees`, with the list re-fetched.
3. Search "petrov": the count shows 1 of N. Open the row by its link name → `/trainees/<id>`.
4. Details calls:
   - `GET /api/trainees/<id>`
   - `GET /api/trainees/<id>/subscriptions`
   - `GET /api/attendance/trainees/<id>`
   - `GET /api/plans?active=true`
5. Sell a subscription:
   - the first plan is preselected and Paid shows its price;
   - switch the plan, and Paid follows;
   - set Paid to 40.5;
   - submit → `POST /api/trainees/<id>/subscriptions {planId, startsAt:'2026-11-02', paidCents:4050}`;
   - the subscriptions GET runs again and the new ACTIVE row shows.
6. Delete that subscription: confirm → `DELETE /api/subscriptions/<subId>`, and the row disappears.
7. "Create account" → `/trainees/<id>/account` → `GET /api/trainees/<id>`.
   - A short password shows the length error; a mismatch shows the mismatch error.
   - Submit → `POST /api/accounts/trainee/<id> {email, role:'TRAINEE', status:'ACTIVE', password, confirmPassword}` → back on `/trainees/<id>`.
8. With `accountId` now in the trainee fixture, details also calls `GET /api/accounts/<accountId>`, and the account section shows the email and status.

### J6. Settlement lifecycle (P1, money) [desktop]
1. ADMIN token. `/settlements` → `GET /api/settlements`. "Generate settlement".
2. Both dates default to 2026-11-02. Set 2026-10-01 to 2026-10-31. Submit → `POST /api/settlements {periodStart:'2026-10-01', periodEnd:'2026-10-31'}` → the app lands on `/settlements/<id>`.
3. Details calls:
   - `GET /api/settlements/<id>`
   - `GET /api/settlements/<id>/allocations?offset=0&limit=500`
   - `GET /api/trainers`, `GET /api/trainees`
   - `GET /api/gym-locations?includeInactive=true`
4. Lines and allocations render with resolved trainer, trainee and gym names. `settlement-status` shows `t('enums.settlementStatus.DRAFT')`.
5. Filter by trainer → the allocations GET runs again with `&trainerId=…`.
6. Finalize → `POST /api/settlements/<id>/finalize` with body `{}` → `settlement-status` shows the FINAL label and the Finalize button is gone.
7. Back to the list. Delete a settlement: the confirm shows the period; accept → `DELETE /api/settlements/<id>`, and the row is gone. Variant: the DELETE → 409, a danger notice shows above the list, and the list stays.
8. Same flow as a TRAINER: no generate action, no delete buttons, no finalize button, no trainer filter.

### J7. Cash register manual entry (P1, money) [desktop, mobile]
1. ADMIN token. `/cash-register` → `GET /api/cash-register`. `cash-register-balance` shows the fixture balance.
2. Amount 0 → error, no POST. Amount 12.345 → error, no POST.
3. Direction OUT, amount 12.34, notes "  float top-up  ".
   - Save → `POST /api/cash-register/transactions/manual {direction:'OUT', amountCents:1234, notes:'float top-up'}`.
   - The success notice shows and `GET /api/cash-register` runs again.
   - The balance shows the new fixture value, and the form is back to IN / 0 / empty.
4. Variant: notes left blank → the body has no `notes` key.
5. Variant: the GET returns a negative balance → the balance still renders, negative and formatted.

Role access to this page is checked in J2 only.

### J8. Trainee self-service, navigation shell and preferences (P1) [mobile, plus a desktop smoke run]
1. TRAINEE token with `traineeProfileId=P1`, landing on `/my-profile`. The page calls:
   - `GET /api/attendance/trainees/P1`
   - `GET /api/trainees/P1/subscriptions`
   - `GET /api/plans`
2. Subscriptions are filtered to Active. Switching to Exhausted and then All changes the rows and the empty message. The trainings table renders.
3. Tab "Stats" → `GET /api/trainees/me/training-insights`. The ranked lists render; weekdays come from `weekdayNumber`.
4. Tab "Records" → coming-soon state, with no API call.
5. Tab "Account" (`aria-haspopup="dialog"`) opens the sheet, a real `<dialog>`. Check that:
   - the tab gets `aria-expanded="true"` and focus is inside the dialog;
   - Escape closes it, `aria-expanded` goes back to `false` and focus returns to the tab;
   - reopening and tapping the backdrop closes it;
   - on a staff phone, the "More" sheet closes when a tile is chosen, and the More tab shows as current on a sheet page such as `/plans`. That needs an ADMIN token, so it is a separate test in this journey; it reuses the same sheet component.
6. In the sheet, switch the language to БГ:
   - `<html lang="bg">`;
   - the tab names come from `bg.json`;
   - after a reload it is still Bulgarian (`localStorage.lang`);
   - switch back.
7. Theme Dark → `data-theme="dark"`, which survives a reload.
8. Log out from the sheet → `/login`.
9. Variant: a token without `traineeProfileId` → the missing-profile message, and no data calls.

### J9. Plan catalog management (P1) [desktop]
1. ADMIN token. `/plans` → `GET /api/plans`. The Active filter → `GET /api/plans?active=true`; Inactive → `active=false`.
2. "New plan":
   - type Punch card, so credits are required (an empty value shows an error);
   - title "10 visits", price 45.5, credits 10;
   - save → `POST /api/plans {type:'PUNCH', title:'10 visits', priceCents:4550, isActive:true, credits:10}` (no `durationDays` key) → the app lands on `/plans`.
3. Open the plan → `GET /api/plans/<id>`. Edit:
   - switch to Time-based; credits is cleared and duration is required;
   - set 30 days and save → `PATCH /api/plans/<id> {type:'TIME', title, priceCents, isActive, credits:null, durationDays:30}`.
4. Deactivate → `DELETE /api/plans/<id>` → `/plans`.
5. Variant: the POST → 400. Characterize what the user sees (S1). Today the error doesn't render and the button stays "Saving..." until the next interaction.

---

## Suspected unintended behavior (to characterize, then log in `TEST_NOTES.md`)

These come from reading the code. Each gets a `// CHARACTERIZATION: possibly unintended` test pinning today's behavior. Copy the entry to `TEST_NOTES.md` when its test lands. Nothing here gets fixed in the test PRs.

- **S1 — Form errors don't render (zoneless).** Confirmed with a throwaway probe spec on plan-create (not committed).
  - Some create, edit and delete handlers set `errorMessage`/`submitting` in the HTTP callback without `detectChanges()`. A failed save then shows nothing, and the submit button stays disabled on "Saving..." until the user interacts again.
  - Affected pages:
    - create, edit and delete for plans, gyms, gym subscriptions, training times and trainers;
    - create, edit and delete for trainees;
    - the subscription sale on trainee details.
  - The same handlers call `router.navigate` on success, so success looks fine.
- **S2 — Subscription start date is UTC.** Trainee details defaults `startsAt` to the UTC date. Between 00:00 and 02:00/03:00 Sofia time it is yesterday. Register attendance and settlements use the local date.
- **S3 — Subscriptions on inactive plans show an id.** Trainee details loads only active plans, so a subscription on a deactivated plan shows its raw `planId` as the plan name.
- **S4 — Stale report data.** On Home, inactive-report requests aren't cancelled when the selection changes; a slow earlier response can overwrite a newer one.
- **S5 — Invisible success notice.** Change password sets the success notice and navigates away immediately, so it is never seen.
- **S6 — No expiry check.** `isAuthenticated()` ignores `exp`. Guards admit expired tokens until the first API 401. Low impact, but it is how sessions behave.
- **S7 — Blank plan titles pass validation.** A whitespace-only plan title passes and is sent as `''`. The other forms use `trimmedLength`.
- **S8 — A failed account load allows a second account.** On the trainee/trainer account page, a failed or `null` account GET for a linked profile falls back to "create account" mode.
- **S9 — Trainer without a profile sees all sessions.** A TRAINER token without `trainerProfileId` gets unfiltered attendance history (but can't delete anything).
- **S10 — Allocations capped at 500.** Settlement allocations stop at 500 rows with no paging.
- **S11 / S12 — No range checks.** Settlement generate and training times have no client-side range check (start ≤ end); only the API validates.
- **Also note, low priority:**
  - `AppComponent` logs `environment.production` and the health response to the console in production.
  - The login password minimum is 3, but 8 everywhere else.
  - The initial password change is enforced only by the post-login redirect; the user can navigate away from `/change-password`.
  - Account deactivation has no confirm dialog, unlike the other destructive actions.
  - Settlement details calls `/api/trainers` and `/api/trainees` as a TRAINER. If the API forbids that, names silently fall back to ids (check against theindex-api).

---

## Plan review (self-critique, applied above)

The plan was reviewed against three goals: tests that survive a redesign, fail when behavior breaks, and are worth maintaining. Several assumptions were checked against the code and the tooling, not just re-read. What the review changed:

1. **CRUD pages are table-driven.** Plans, gyms, gym subscriptions, training times and trainers have near-identical create, edit, details and delete pages, about 25 components. Listing a spec per page would be mostly copy-paste. §7 now has three table-driven specs plus each page's own logic. Coverage is the same, and a new resource needs only a new row.
2. **Existing smoke tests are not coverage.** `home` and `app` "should create" pass even when behavior breaks, so they are marked `[~]` with replacements planned. The existing `navigation`, `theme`, `language`, `locale-format`, `trimmedLength`, `avatar`, `ranked-list` and `segmented-control` specs do assert behavior, so they are `[x]`.
3. **Assert what the user sees in a zoneless app.** It is easy to assume an error message renders once the field is set. A throwaway spec showed it doesn't; the same pattern appears in 19 submit handlers (S1). A test that checks only the component field would pass while users see nothing, so §0 requires DOM assertions.
4. **Date defaults are time-zone sensitive.** "Defaults to today" passes at noon whatever the code does. Clocks are pinned near midnight Sofia time instead, which separates the local-date code paths from the UTC one (S2).
5. **Validators are tested through their forms.** Exporting the private validators would break the production-code rule.
6. **The nav sheet moved to E2E.** jsdom has no `HTMLDialogElement.showModal()` (checked), and a stubbed dialog would only test the stub. The sheet's behavior is in J8, in a real browser.
7. **Accessible names come through `t(key)`.** Literal UI text in E2E selectors would break on copy edits. With the helper, a renamed label is harmless but a missing one fails. The `data-testid` list is explicit and minimal.
8. **E2E mocks the API by default.** Running against the real API needs theindex-api and Postgres in CI, and can't produce error states on demand. Network-level mocks are the default; a real-API smoke run is an open question below.
9. **Each check lives in one place.** Role checks live in J2 only (J7 had repeated one). The More/Account sheet, language and theme checks are folded into J8, not given their own journeys. That leaves nine journeys, each a flow a real user does every week.
10. **Corrections from checking the code:**
    - the training-time option label uses a hyphen, so J3 selects by value;
    - the sheet tab exposes `aria-expanded`, so J8 asserts that rather than a vague "active state";
    - `src/testing/` helpers are type-checked by the app build (§0).

### Open questions for the owner
- [ ] May we add the `@real-api` E2E smoke run against a local theindex-api (Docker Postgres + seed), and may the deploy workflow run unit and E2E tests before building? Both touch `.github/workflows/`, which needs your approval.
- [ ] Should S1 get fixed soon after it is pinned? It affects every catalog form and the trainee forms. Per the rules, the fix PR will flip the characterization tests first.

## Suggested order of work
1. Shared test helpers (`src/testing/jwt.ts`, HTTP flush helpers) and §1 (access control).
2. §2 and §3 (sign-in and money), then §4 (attendance).
3. §11 services (fast, broad), then §5–§8.
4. E2E setup (B0) with the `data-testid` PR, then J1, J2, J3, J5, J4, J6, J7, J8, J9.
5. §9, §10, §12 last.
