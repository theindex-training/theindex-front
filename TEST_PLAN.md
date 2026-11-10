# Test plan: characterization tests for theindex-front

Rules are in `CLAUDE.md` → "Testing". In short:
- Current production behavior is the spec.
- Mock only at boundaries.
- Every test must fail when its behavior breaks.
- Anything that looks wrong is pinned with `// CHARACTERIZATION: possibly unintended` and logged in `TEST_NOTES.md`.

**Baseline (2 Nov 2026):** 13 spec files and 47 tests, all passing (`npx ng test --watch=false`). There are no E2E tests and Playwright is not a dependency yet.

**Progress:**
- PR 2 (§1–§4, the P0 sections): 27 spec files, 249 tests.
- Every P0 area was mutation-checked: 12 deliberate breaks in production code, and each one was caught by a spec.
- CI (`.github/workflows/docker-ghcr.yml`) runs the unit tests, the production build and the E2E journeys on every pull request and every push to `main`. The image is built and deployed only after both test jobs pass (PR 6, laid out like theindex-api's workflow).
- PR 3 fixed S1 and S2. It added `pages/save-errors.spec.ts`, the error-handling row of §7's table for every catalog and trainee form, and brought the suite to 28 spec files and 267 tests.
- PR 4 covered §5–§12 (62 spec files, 547 tests; 17 more breaks in production code, all caught). It pinned S4, S8, S10, S11 and S12, and found S15 and S16.
- PR 5 set up E2E (Playwright, API mock, CI job) and added all nine journeys: 37 E2E tests over the desktop and mobile projects. It found S17.
- The trainings calendar (a feature, not a test PR) came with its own specs: 65 spec files, 587 unit tests, plus journey J10 (39 E2E tests). Three deliberate breaks (UTC day keys, list as the default view, no unpaid marker) were each caught.
- The content categories (a feature: theindex-web decision record, backlog item 9) came with §13 and journey J11: 67 spec files, 623 unit tests, 41 E2E tests. Four deliberate breaks in `category-form.ts` (description not cleared to `null`, empty slug sent, no slug length check, fractional order accepted) were each caught.
- The article list and editor (backlog item 10) came with §14 and journey J12: 72 spec files, 695 unit tests, 43 E2E tests. Six deliberate breaks: autosave sending every field, an emptied optional field sent as `""`, the list `meta` kept, a 409 not stopping the autosave and an image caption lost on save were caught at once; a slug sent after the first publish slipped through, so it got the "published meanwhile" test, which catches it.
- The publishing actions (backlog item 11) came with §15 and journey J13: 73 spec files, 721 unit tests, 45 E2E tests. Ten deliberate breaks were each caught: no save before publishing, Unpublish without its confirmation, "unpublished changes" lost when the draft moved on while publishing, the 400's problems not listed, the preview tab's `opener` kept, Update enabled with nothing to update, Discard not rebuilding the editor, the body always sent, blocks compared with their key order, and the saved blocks not updated after a save (the last one got its own test first).
- The renewals page (a feature) came with §16 and journey J14: 75 spec files, 729 unit tests, 47 E2E tests. Three deliberate breaks (the punch tab showing the time lists, the subscription count dropped from the plan, days left shown as days since the end) were each caught.
- The workouts area (a feature: workouts, exercises, workout types, PDF import) came with journey J15 and its own specs (`pages/workouts/*.spec.ts`, `services/workouts-api.services.spec.ts`): 81 spec files, 816 unit tests, 51 E2E tests. One deliberate break (the women's amount dropped from the payload) was caught.

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

- **Zoneless app.** After `HttpTestingController.flush()`, call `await fixture.whenStable()` before reading the DOM. A field updated in an HTTP callback without `detectChanges()` never reaches the DOM; S1 was exactly this, in 19 handlers. Assert what the user sees. Where the DOM is stale, assert both the stale DOM and the field, and mark the test CHARACTERIZATION.
- **Real collaborators.** Use the real services, interceptor, router and Transloco (from `src/test-providers.ts`, English). For navigation, use `provideRouter([{ path: '**', children: [] }])` and assert `TestBed.inject(Router).url`. Don't spy on `navigate`.
- **Page interaction** goes through `src/testing/dom.ts`. `driver(root, whenStable)` gives `type`, `select`, `check`, `click`, `submit`, `settle`, `text` and `alert`; `apiError(message, status)` builds a NestJS-shaped error to flush.
- **Request bodies:** assert optional keys on the wire with `JSON.parse(req.request.serializeBody())`. A payload property set to `undefined` is dropped by JSON, but `toEqual` can't see the difference.
- **Auth state** comes from a shared `src/testing/jwt.ts` helper. It holds `makeToken({ sub, role, email, trainerProfileId, traineeProfileId })` and `signInAs(role, claims?)`, which writes `localStorage.accessToken`. `localStorage.clear()` runs in `beforeEach`.
- **Shared helpers in `src/testing/`** get type-checked by the production build: `tsconfig.app.json` includes `src/**/*.ts` and excludes only `*.spec.ts`. So they must be plain TypeScript with no `vi`/`describe` globals and no app imports. Anything that needs Vitest stays inside the spec files.
- **Time:** every spec runs in `Europe/Sofia`; `src/test-providers.ts` sets `process.env.TZ`, so it applies locally and in CI. For "today" defaults:
  - fake only the clock: `vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T22:30:00Z') })`, which is 00:30 on 2 Nov in Sofia and still 1 Nov in UTC;
  - leave timers real, so `whenStable()` and router navigation still work;
  - `vi.useRealTimers()` in `afterEach`.
- **Private validators** (the plan, trainee-details and cash-register `currencyValidator`s, and `integerValidator`) aren't exported. Exporting them would change production code, so test them through the form controls of the component that owns them.
- **Table-driven specs** for the near-identical CRUD pages (§7) instead of twenty copy-pasted files. Each row must still fail on its own when that page breaks.
- **Spec files are not scanned by `i18n-keys.spec.ts`,** so specs may use key strings freely.

---

## Part A — Unit tests

### 1. Access control and session (P0)

**`services/auth.service.ts` → `auth.service.spec.ts`**
- [x] `login()` POSTs `/api/auth/login` with `{ email, password }` exactly as given, untrimmed. On success it stores `accessToken` under `localStorage.accessToken`.
- [x] `login()` stores nothing when the request fails, and the error reaches the subscriber.
- [x] `logout()` removes only `accessToken`; `theme` and `lang` survive.
- [x] `isAuthenticated()` is true for any non-empty stored string, including a malformed token and a token whose `exp` is in the past. There is no expiry check. CHARACTERIZATION, see S6.
- [x] Claim getters (`getUserRole`, `getAccountId`/`sub`, `getTrainerProfileId`, `getTraineeProfileId`):
  - return the claim, or `null` when it is missing or explicitly `null`;
  - return `null` with no token;
  - return `null` for a token without a payload segment, with invalid base64, or with invalid JSON (never throw).
- [x] Decoding handles base64url (`-`, `_`) and missing `=` padding, using a payload crafted to contain both.
- [x] `getUserEmail()` returns `email`, falls back to `sub`, then `null`.

**`services/auth.interceptor.ts` → `auth.interceptor.spec.ts`** (real `HttpClient` with `withInterceptors([authInterceptor])`)
- [x] With a token: the request carries `Authorization: Bearer <token>`. Without one: no `Authorization` header.
- [x] The token is read per request: log in, and the next request carries the new token.
- [x] 401 with a token stored: the token is removed, the router ends at `/login`, and the original error still reaches the caller.
- [x] 401 without a token (e.g. a wrong-password login): the token is untouched, there is no navigation, and the error is rethrown.
- [x] 403, 500 and status 0: the token is kept and there is no navigation.

**`guards/*.ts` → one spec per guard, using `TestBed.runInInjectionContext`**
- [x] `authGuard`: no token → `UrlTree('/login')`; any token → `true`.
- [x] `loginGuard`: no token → `true`; `TRAINEE` → `/my-profile`; `ADMIN`, `TRAINER`, an unknown role or an undecodable token → `/home`.
- [x] `roleGuard`:
  - no token → `/login`;
  - no `data.roles` or an empty list → `true`;
  - role allowed → `true`;
  - `TRAINEE` not allowed → `/my-profile`;
  - `TRAINER` not allowed, or no role → `/unauthorized`.

**`app.routes.ts` → `app.routes.spec.ts`** (route config is access control, so it gets pinned)
- [x] Table test over the flattened route tree. Every path has exactly the documented `roleGuard` + `data.roles`:
  - ADMIN only: `trainers/**`, `settlements/new`, `cash-register`;
  - TRAINEE only: `my-profile`, `stats`, `records`;
  - `change-password`: authenticated users of any role, with no `roleGuard`;
  - everything else under the shell: ADMIN + TRAINER;
  - the shell itself has `authGuard`, and `login` has `loginGuard`.
- [x] A new route without a row in the table fails the test.
- [x] Integration with `RouterTestingHarness` and the real routes (lazy components load):
  - `/` → `/login`;
  - signed-in staff at `/` → `/home`;
  - `/plans/new` resolves to the create page, not to details with id `new` (order matters);
  - an unknown URL → the not-found page;
  - the document title is "<page> · The Index" (see §10).

### 2. Sign-in and password change (P0)

**`pages/login/login.component.ts` → `login.component.spec.ts`**
- [x] Empty submit sends no request and shows both field errors. A password shorter than 3 characters shows the length error.
- [x] Success with a token without `sub`: no password-status call; it navigates to `/home` (staff) or `/my-profile` (trainee).
- [x] Success with `sub`: GET `/api/accounts/<sub>/password-status`.
  - `true` → the default route by role;
  - `false` → `/change-password`;
  - an HTTP error → the default route.
- [x] Login error:
  - shows the API `message` (a string, or an array joined with ", ");
  - falls back to `auth.login.error` when there is no usable message;
  - the button is enabled again;
  - no token is stored.

**`pages/change-password/change-password.component.ts` → `change-password.component.spec.ts`**
- [x] On init with an account: GET password-status.
  - `false` → the phone field appears and is required;
  - `true` → no phone field;
  - error → no phone field and loading ends.
- [x] No `sub` in the token: no request. Submit shows `auth.changePassword.noAccount` and sends nothing.
- [x] Validation:
  - each password field needs 8 or more characters;
  - mismatched new and confirm show `mismatch` only on the confirm field;
  - the error getters return '' until the field is touched.
- [x] Phone required but blank or whitespace: the phone is marked touched and no request is sent.
- [x] Payload: `{ currentPassword, newPassword, confirmPassword }`, plus `phone` (trimmed) only when it is required.
- [x] Success: the form resets and the app navigates by role. `successMessage` is set but the page navigates away at once, so it is never seen. CHARACTERIZATION, see S5.
- [x] Error: the API message or the `auth.changePassword.error` fallback; the button is enabled again.

### 3. Money: subscriptions, plans, cash (P0)

**`pages/trainees/trainee-details.component.ts`, selling a subscription** (the spec covers the whole page; this part first)
- [x] Plans load from `GET /api/plans?active=true`. The first plan is preselected and **Paid** is prefilled with its price in euros (`4550` cents → `45.5`).
- [x] Changing the plan re-fills **Paid** from that plan's price, overwriting a manual edit.
- [x] Paid validation:
  - blank fails required;
  - negative is invalid;
  - three decimals is invalid;
  - `45.50` is valid;
  - `0.1 + 0.2`-style floats round correctly (`0.3` → `30` cents).
- [x] Submit POSTs `/api/trainees/<id>/subscriptions` with `{ planId, startsAt, paidCents }`.
- [x] The default `startsAt` comes from `new Date().toISOString().slice(0,10)`, which is the **UTC** date. At 00:30 Sofia time it pins yesterday's date. CHARACTERIZATION, see S2.
- [x] After success:
  - the subscription list is fetched again;
  - **Paid** resets to the chosen plan's price;
  - `startsAt` resets to today (UTC);
  - the plan stays selected.
- [x] Error: the API message shows and the button is usable again (S1, fixed in PR 3).

**`pages/plans/plan-create.component.ts` / `plan-edit.component.ts`**
- [x] Price → `priceCents` via `Math.round(price*100)`, including a float edge case.
- [x] Type PUNCH: credits required, ≥ 1 and an integer; duration has no validators and is cleared.
- [x] Type TIME: the reverse.
- [x] Switching type clears the other field's value.
- [x] Create payload: `{ type, title (trimmed), priceCents, isActive }` plus `credits` (PUNCH) or `durationDays` (TIME). The other key is absent.
- [x] Edit payload: the same, but always sends both keys, the unused one as `null`.
- [x] Edit: patches the form from GET `/api/plans/<id>`, prices shown in euros (`toEuros`).
- [x] The title has only `Validators.required`, so whitespace-only passes and is sent as `''`. CHARACTERIZATION, see S7.
- [x] Success → `/plans`. Error: the API message shows and the button is usable again (S1, fixed in PR 3).

**`pages/cash-register/cash-register.component.ts`**
- [x] Load: GET `/api/cash-register` shows the balance and transactions. Error → the danger state with "Try again", which reloads.
- [x] Amount:
  - `0` and negative values fail `min(0.01)`;
  - three decimals fail;
  - `12.34` → `amountCents: 1234`.
- [x] Payload `{ direction, amountCents, notes? }`: notes are trimmed, and whitespace-only notes are omitted (`notes` absent from the JSON body).
- [x] A second submit while one is in flight is ignored (exactly one request).
- [x] Success:
  - the form resets to IN / 0 / '', untouched;
  - the `cashRegister.created` notice shows;
  - the state is reloaded (second GET).
- [x] Error: the `formErrorMessage` notice; the form keeps its values.
- [x] `formatTransactionDetails` (P2):
  - SETTLEMENT with a period, and without one;
  - SUBSCRIPTION with buyer, plan and type parts joined by " • ", and with no parts;
  - any other type → `-`;
  - `sourceDetails` null → `-`.
- [x] `formatTransactionType` (P2): a known enum is translated; an unknown `SOME_NEW_TYPE` becomes "Some New Type".
- [x] Buyer label "Name (nick)" or `unknownTrainee`. The buyer link goes to `/trainees/<id>`, or `/trainees` when there is no id.

### 4. Attendance (P0)

**`pages/attendance/attendance-register.component.ts`**
- [x] On init: exactly four GETs.
  - `/api/trainers?active=true`
  - `/api/gym-locations?includeInactive=false`
  - `/api/training-times`
  - `/api/trainees?active=true`
- [x] Inactive items in the responses are still filtered out on the client.
- [x] Training times are sorted by start time ("08:00" before "18:30", whatever order the API sends).
- [x] Preselection:
  - the signed-in trainer's `trainerProfileId` when it is in the list, otherwise the first trainer;
  - the first gym;
  - the date is today in **local** time (contrast with S2).
- [x] Search is case-insensitive over name or nickname. "Select shown" and "Clear shown" affect only the filtered trainees. Selections survive filter changes.
- [x] Submit with an invalid form: no request, fields touched.
- [x] Submit with no trainee selected: `attendance.register.selectAtLeastOne` and no request.
- [x] Payload `POST /api/attendance/batch`: `{ trainerId, locationId, traineeIds, trainedDate }`, plus `trainedTime` as `HH:mm` only when a time is picked ("Not specified" omits the key).
- [x] Success → `/attendance`.
- [x] Error → the API message is shown in the DOM (this page does call `detectChanges`); the selection is kept.
- [x] Load error → `attendance.register.loadError`.

**`pages/attendance/attendance-sessions.component.ts`**
- [x] Default range: from 7 days ago to today, local dates (fake clock).
- [x] Sessions are listed newest first by start time (chips and session panels), whatever order the API sends; ties keep the API order, and attendees keep their order.
- [x] ADMIN:
  - loads `/api/trainers?active=true`;
  - `trainerId` is sent only when a trainer is picked;
  - `startTime` and `endTime` are sent only when set.
- [x] TRAINER:
  - no trainers request;
  - `trainerId` is always their own profile id;
  - a trainer token without `trainerProfileId` sends no `trainerId`, so it sees every trainer's sessions. CHARACTERIZATION, see S9.
- [x] Session selection after a load:
  - keys still present stay selected;
  - if none remain, all sessions are selected;
  - no sessions → none selected;
  - `toggleSession` adds and removes keys.
- [x] Summary over the selected sessions: sessions, attendance, paid and unpaid come from `totals`; `finalPriceCents` sums only `price.isFinal` items.
- [x] Price helpers: `attendancePrice` gives '—' when the price isn't final; `sessionTotalPrice` sums final prices only.
- [x] `canDeleteSessionAttendance`: ADMIN can delete in any session; TRAINER only in sessions with their own `trainerId`.
- [x] Delete:
  - `window.confirm` gets the translated text with name, date and time; cancel → no request;
  - OK → `DELETE /api/attendance/<id>`, the row is removed locally and `totals` are recomputed from the remaining items;
  - a second delete while one is in flight is ignored;
  - error → message.
- [x] Label helpers:
  - trainer is "Name (nick)" or "Name", or '—' when unknown;
  - the tab title uses the nickname, falling back to the name;
  - trainee and location fall back to '—'.

### 5. Trainees and accounts (P1)

**`pages/trainees/trainees.component.ts`** (extends the existing spec, which covers display helpers only)
- [x] The filter maps to the request: All → no `active` param; Active → `active=true`; Inactive → `active=false`.
- [x] Gym cards load from `/api/gym-subscriptions?includeInactive=true`. A failure falls back to `[]`, and the list still renders.
- [x] Search is client-side, trimmed, case-insensitive, over name or nickname. Changing the filter keeps the term applied. `TraineesService.list` supports `search`, but the page never sends it.
- [x] The count shows shown / total. "Clear search" restores all rows.
- [x] Nickname quoting, gym card lookup, trailing chip (existing spec).

**`trainee-create` / `trainee-edit`**
- [x] Validation: name required and 2–100 trimmed; nickname optional, 1–50 trimmed.
- [x] Create payload: `{ name (trimmed), nickname|null, phone|null, gymSubscriptionId, isActive: true }`. Blank optional fields become `null`.
- [x] Create loads gym cards with `GET /api/gym-subscriptions` (no `includeInactive`); edit loads them with `includeInactive=true`.
- [x] Edit patches the form from GET. Its payload has no `isActive`.
- [x] Success → `/trainees`. (The error path is covered by `pages/save-errors.spec.ts`.)

**`trainee-details`** (beyond §3)
- [x] On init: four parallel GETs (`/api/trainees/<id>`, `…/subscriptions`, `/api/attendance/trainees/<id>`, `/api/plans?active=true`), plus `GET /api/accounts/<accountId>` when the trainee is linked. An account error → no account section.
- [x] `canDeleteSubscriptions` is true for ADMIN and TRAINER (any other role can't reach the page).
- [x] The subscription filter defaults to ACTIVE. The status match ignores case. Each filter has its own empty-message key.
- [x] Deleting a subscription:
  - confirm text includes the plan and start date; cancel → no request;
  - `DELETE /api/subscriptions/<id>` removes it locally;
  - a second delete is blocked while one is in flight;
  - error → message.
- [x] A plans load error is written into `subscriptionErrorMessage`, the same slot as subscription errors.
- [x] A subscription whose plan isn't in the active-plans list shows the raw `planId` as its name. CHARACTERIZATION, see S3.
- [x] `formatPlanOption`: "Title · Punch card · €45.00".

**`trainee-delete`**
- [x] Shows the details with linked/not-linked status. Confirm → `DELETE /api/trainees/<id>` → `/trainees`. (The error path is covered by `pages/save-errors.spec.ts`.)

**`trainee-account` and `trainer-account`** (the same code with a different role; one table-driven spec)
- [x] Profile without `accountId` → create mode. Password and confirm are required; the validator returns `passwordLength` for fewer than 8 characters and `passwordsMismatch` otherwise.
- [x] Create payload `POST /api/accounts/{trainee|trainer}/<profileId>`: `{ email (trimmed), role: 'TRAINEE'|'TRAINER', status: 'ACTIVE', password, confirmPassword }`.
- [x] Profile with `accountId` → `GET /api/accounts/<accountId>`, then edit mode with the email prefilled. A blank password is allowed and omitted from the PATCH; a filled one sends both password fields.
- [x] The account GET fails, or returns `null`, while the profile has `accountId`: the page falls back to create mode, and submitting would provision a second account. CHARACTERIZATION, see S8.
- [x] Deactivate: `DELETE /api/accounts/<accountId>` → back to the profile details. A second click while in flight is ignored. There is no confirm dialog (record as behavior).
- [x] Success → `/trainees/<id>` or `/trainers/<id>`. Errors → the API message or the create/update/deactivate fallback keys, shown in the DOM (these handlers call `detectChanges`).

### 6. Settlements (P1, money-adjacent)

**`settlements.component.ts`**
- [x] `canManageSettlements` only for ADMIN. For a TRAINER the generate action is hidden, the delete buttons are hidden, and `deleteSettlement()` is a no-op.
- [x] Delete:
  - confirm text with the period; cancel → no request;
  - `DELETE /api/settlements/<id>` → removed locally;
  - error → the list stays, with a danger notice above it;
  - a second delete while one is in flight is ignored.

**`settlement-generate.component.ts`**
- [x] Both dates default to local today (fake clock).
- [x] An empty date → `missingDates` and no request.
- [x] No start ≤ end check: the request goes out and the API decides. CHARACTERIZATION, see S11.
- [x] `POST /api/settlements {periodStart, periodEnd}` → `/settlements/<response.settlement.id>`. Error → message.

**`settlement-details.component.ts`**
- [x] On init:
  - `GET /api/settlements/<id>`;
  - `GET …/allocations?offset=0&limit=500`;
  - `GET /api/trainers`, `GET /api/trainees` (no params);
  - `GET /api/gym-locations?includeInactive=true`.
- [x] The admin trainer filter re-requests allocations with `trainerId`; "All" omits it.
- [x] Allocations are capped at 500 with no paging; the page shows "N of total". CHARACTERIZATION, see S10.
- [x] Finalize is visible and works only for ADMIN on a DRAFT settlement: `POST …/finalize` with `{}`, the status updates and the button disappears. Error → message. `finalizeSettlement()` is a no-op for a TRAINER or a FINAL settlement.
- [x] Labels:
  - trainer = trimmed nickname or name;
  - trainee = "Name (nick)";
  - gym name;
  - each falls back to the raw id;
  - a missing id → '—';
  - a failed entity request falls back silently.

### 7. Catalog CRUD family (P1): plans, gyms, gym subscriptions, training times, trainers

One table-driven spec per page type (`crud-details.spec.ts`, `crud-forms.spec.ts`, `crud-delete.spec.ts`), with one row per resource. Every row checks:
- [x] details / edit / delete: a missing `:id` → that resource's `errors.missingId` and no request. A load error → the API message or `errors.load`. A loaded record is shown (details) or patched into the form (edit).
- [x] create / edit: an invalid form sends nothing and marks fields touched. The payload is exactly as listed below. Success → the list URL.
- [x] delete/deactivate: `DELETE /api/<resource>/<id>` → the list URL.
- [x] Every create / edit / delete page shows the API error and gives the button back after a failed save (`pages/save-errors.spec.ts`, the S1 fix).

| Resource | Create/edit payload and validators | List request and filter |
|---|---|---|
| Plans | see §3 | All → no param, Active → `active=true`, Inactive → `active=false` |
| Gyms | `{ name (2–120 trimmed), address (optional, 2–250, blank → null) }`; no notes, no isActive | All/Inactive → `includeInactive=true`, Active → `includeInactive=false`; Inactive also filters `!isActive` on the client |
| Gym subscriptions | `{ name (2–120 trimmed) }` | as Gyms |
| Training times | `{ startTime, endTime }`, both required; no end > start check (S12) | no filter; times shown as `HH:mm` |
| Trainers | create `{ name (2–100), nickname|null (1–50), isActive: true }`; edit without isActive | filter as Plans plus client-side search as Trainees |

- [x] Plans list `formatPlanDetails`: PUNCH → "10 credits" (ICU), TIME → "30 days". A null count shows 0.
- [x] Trainers list: search, count, nickname label (mirrors §5).

### 8. Dashboards (P1)

**`pages/home/home.component.ts`** (replaces the existing "should create" spec, which is `[~]`)
- [x] The old "should create" spec was replaced in PR 4.
- [x] Reports load only for ADMIN or TRAINER: `GET /api/attendance/reports/inactive-trainees?skipDays=7` and `GET …/reports/without-active-subscription`.
- [x] Changing "Inactive for" to 30 sends `skipDays=30`. Each report has its own loading, error and empty states.
- [x] Changing the selection twice quickly: responses aren't cancelled, so a late response for 7 days can overwrite the 30-day result. CHARACTERIZATION, see S4.
- [x] `traineeDisplayName`: "Name (nick)", a trimmed name, or `home.reports.unknown`.
- [x] `formatSubscriptionSummary` (P2):
  - `null` → '—';
  - parts in order, joined by " • ";
  - `remainingTrainings: 0` is included (it only skips `null`);
  - an unknown plan type is passed through;
  - no parts → '—'.

**`pages/trainee-dashboard/trainee-dashboard.component.ts`**
- [x] No `traineeProfileId` in the token: no requests. The missing-profile message is set but never shown; empty lists show instead. CHARACTERIZATION, see S16.
- [x] Three parallel GETs: `/api/attendance/trainees/<id>`, `/api/trainees/<id>/subscriptions`, `/api/plans` (no `active` param, unlike trainee details).
- [x] If any of the three fails, every section shows the same error.
- [x] The filter defaults to ACTIVE. Each filter's empty key and the case-insensitive match are checked.
- [x] Trainings show in the calendar on the current month by default, and in the list after switching (the page passes its trainings and empty key through). Same check on trainee details (§5's page).

**`pages/stats/stats.component.ts`**
- [x] `GET /api/trainees/me/training-insights` maps into the five ranked lists.
- [x] A weekday label comes from `weekdayNumber` in the active language (7 → Sunday / Неделя). Number 0 or missing → the API's `weekday` string.
- [x] Error → API message or fallback.

### 9. Navigation shell (P1)

- [x] `buildNavigation` / `isUrlInItems` (existing `navigation.spec.ts`; it already fails on role leaks).
- [x] `MainLayoutComponent.isSheetPageActive()` follows `router.url` after a `NavigationEnd`. (Closing the sheet on navigation needs a real `<dialog>`, so it is checked in E2E J8.)
- [x] `UserBlockComponent`:
  - initials are the first two alphanumerics of the email, upper-cased, or `U`;
  - Log out removes the token and the router ends at `/login`;
  - the role label is translated.
- The nav sheet's open, close, Escape, backdrop and focus return need a real `<dialog>`, and jsdom has no `showModal()`. They are covered in E2E J8 instead of stubbing the dialog.

### 10. i18n and formatting (P1/P2)

- [x] `apiErrorMessage`:
  - a string message → `{text}`;
  - whitespace-only → fallback;
  - a string array → joined with ", ";
  - an empty array, a number, a missing body or a `null` error → `{key, params}`.
- [x] `UiMessagePipe`: `null` → ''; `{text}` is passed through; `{key}` is translated and re-translated after `LanguageService.use('bg')`.
- [x] `EnumLabelPipe`: a known value is translated (lower-case input works); an unknown value is shown raw; empty → ''; the label follows a language switch.
- [x] `enumLabelKey` / `isKnownEnum` are case-insensitive.
- [x] `TranslatedTitleStrategy`: "<page> · The Index"; just "The Index" for a route without a title; re-titles on a language switch.
- [x] `BundledTranslationLoader`: `en` → the English file; `bg` or any other value → Bulgarian.
- [x] `LanguageService` default / switch / restore / toggle / plurals (existing).
- [x] `LanguageService.setLanguage` when `localStorage.setItem` throws: it still switches.
- [x] `LocaleFormatService` money, dates, date-only values without a timezone shift, fallbacks (existing).
- [x] `LocaleFormatService`: `dateTime`, `clock` (leading zero), `weekday(7)`, `number` with `digitsInfo`, and `money` for negative values.
- [x] `ThemeService` (existing).
- [x] `ThemeService` when storage throws: reading falls back to `system`, and `setMode` still applies the theme.
- [x] Translation file consistency (`i18n-keys.spec.ts`, existing).

### 11. Services: HTTP contract (P1)

One spec per service, each method asserting method, URL, query and body. These pin the hand-written API contract.
- [x] `buildHttpParams`: drops `undefined`, `null` and `''`; keeps `false` → `'false'` and `0` → `'0'`. The status filters depend on this.
- [x] `PlansService.list()` sends no param; `list(true)` / `list(false)` send `active=`. CRUD URLs; `deactivate` is DELETE.
- [x] `GymLocationsService` and `GymSubscriptionsService`: `includeInactive` param; CRUD.
- [x] `TraineesService`: `list(active, search)` params; `getMyTrainingInsights` → `/api/trainees/me/training-insights`.
- [x] `TrainersService` and `TrainingTimesService`: CRUD. Training times have `delete` (DELETE, typed `{ deleted: boolean }`) where the others have `deactivate`.
- [x] `SubscriptionsService`: list and create under `/api/trainees/<id>/subscriptions`; delete is `/api/subscriptions/<id>`.
- [x] `AttendanceService`:
  - `sessions` params (optional ones dropped);
  - `createBatch`;
  - `deleteById`;
  - trainee lists (`/trainees/<id>`, `/paid`, `/unpaid`);
  - the two report URLs and `skipDays`.
- [x] `SettlementsService`: `finalize` POSTs `{}`; `allocations` params; `delete`.
- [x] `CashRegisterService`: state GET; manual POST to `/transactions/manual`.
- [x] `AccountProvisioningService`: `/api/accounts/{trainer|trainee}/<profileId>` and by-id GET, PATCH, DELETE.
- [x] `AccountSecurityService`: `hasChangedPassword` maps the response to its boolean; `changePassword` URL and body.
- [x] `ApiService.health` via `app.component.spec.ts` (GET `/api/health` on startup).

### 12. Utilities and shared components with logic (P2)

- [x] `formatTimeWithoutSeconds`: `'18:30:00'` → `'18:30'`; `'8:5'` → `'08:05'`; `'1830'` is returned unchanged.
- [x] `displayValue`: trims; `null`, `''` or whitespace → '—'; custom fallback.
- [x] `trimmedLength` (existing).
- [x] `TraineeSubscriptionsTableComponent`:
  - the plan title falls back to `planId`;
  - TIME → end date;
  - PUNCH → "used of total", where `used = max(initial − remaining, 0)` and nulls count as 0;
  - `statusTone` ACTIVE → success, EXHAUSTED → danger, otherwise neutral, case-insensitive;
  - the delete button renders only when both `showActionsColumn` and `canDeleteSubscriptions` are set, is disabled while that row is deleting, and emits the subscription.
- [x] `TraineeTrainingsTableComponent`: trainer is nickname or name, or '—'; location name or '—'.
- [x] `utils/calendar.util.ts`: local day keys (a 22:30 UTC training on 31 Oct is 1 Nov in Sofia), Monday-first month weeks padded with `null` (28-day February, leap year), adding days across DST and month ends, adding months across year ends.
- [x] `TrainingsCalendarComponent` (fake `Date` at 00:30 local on 1 Nov, still 31 Oct in UTC):
  - opens on the current local month; today has `aria-current="date"`; Today is disabled there;
  - each training lands on its local day; cells list time, trainer and gym, earliest first, at most two then "+N more"; unpaid trainings get the diamond marker;
  - each day button's name gives the date and the training and unpaid counts;
  - the summary counts only the shown month; "no trainings at all" uses the page's empty key;
  - previous/next across year ends, Today; selecting a day lists it below the grid, again or "Clear selection" clears it, and so does changing month; with nothing selected the month is listed by day;
  - one tab stop; arrows, Home/End, PageUp/PageDown (clamped to a shorter month) move focus across months, and leaving the month clears the selection;
  - loading and error replace the grid; Bulgarian month, weekdays and plurals.
- [x] `TraineeTrainingsComponent`: Calendar by default; List on request, stored in `localStorage.trainingsView` and restored; an unknown stored value or blocked storage falls back to the calendar.
- [x] `LocaleFormatService.weekdayShort` / `monthYear` in both languages (in §10's spec).
- [x] `UiInputComponent` (it is a form control, so it has logic):
  - `writeValue(null)` → '';
  - input calls `onChange`; blur calls `onTouched`;
  - `setDisabledState`;
  - the password toggle flips the input type and the button's accessible name.
- [x] `SearchFieldComponent`: input emits the value; Clear emits '' and refocuses the input.
- [x] `AvatarComponent` initials, `RankedListComponent`, `SegmentedControlComponent` (existing).
- [~] `AppComponent` "should create" adds nothing; the health-check test covers it.
- Not unit-tested (presentational, covered by the pages and E2E): brand, chip, icon, status-dot, skeleton-list, empty-state, page-header, list-row, ui-button, sidebar, tab-bar, theme-switch, language-switch, not-found, unauthorized, records.

### 13. Content: article categories (P1)

**`services/article-categories.service.ts` → `article-categories.service.spec.ts`**
- [x] `list`, `getById`, `create` (POST), `update` (PATCH), `delete` (DELETE) under `/api/article-categories`.

**`pages/content/categories/*` → `categories.spec.ts`** (the four pages through `RouterTestingHarness`; the list reloads after each save)
- [x] List: categories in the API's order, each linking to `/content/categories/<id>/edit`, with slug, description (or "—") and order; the count. Empty → the create action and no count. Error → "Try again" loads again.
- [x] Create:
  - an empty form sends nothing and shows the name error;
  - only the trimmed name is sent when slug, description and order are empty (whitespace-only description included), so the API picks the slug and puts it last;
  - a chosen slug, description and order are sent trimmed → `/content/categories`;
  - refused before sending: slugs with capitals, Cyrillic, spaces, a double or trailing hyphen, or 81 characters; a negative or fractional order; a 61-character or whitespace-only name; a 301-character description;
  - a 409 shows the API message, the button is usable again and the page stays.
- [x] Edit:
  - fills the form from `GET /api/article-categories/<id>`;
  - PATCH sends every field, trimmed, an emptied description as `null` → `/content/categories`;
  - slug and order are required;
  - a refused slug change (409) shows the API message and keeps the typed slug;
  - links to the delete page; a load error shows the API message and no form; a missing id sends nothing.
- [x] Delete: shows name, slug and the warning; `DELETE /api/article-categories/<id>` → `/content/categories`; a failed delete shows the fallback and gives the button back; a missing id sends nothing.
- [x] Routes (`app.routes.spec.ts`): every `content/categories...` route is ADMIN only; `/content` → `/content/categories`; a trainer gets `/unauthorized`. Navigation (`navigation.spec.ts`): "Content" is the last Manage item for admins only, and `/content/...` URLs light up the More tab.

### 14. Content: articles, editor and media picker (P1)

**`services/articles.service.ts`, `services/media.service.ts` → their specs**
- [x] `list` sends only the query values that are set; `getById`, `create {title}`, `saveDraft` (PATCH `/:id/draft` with `baseRevision`).
- [x] Media: `list(page, pageSize)`, `getById`, `upload` as multipart (`file` with its name, `altText`); `mediaThumbnail` picks the narrowest variant wide enough, else the widest, else the master.

**`pages/content/articles/editor/article-content.ts` → `article-content.spec.ts`**
- [x] Stored content → editor data adds the list tool's `meta` (nested items too); other blocks, `time` and `version` pass through; no content → no blocks.
- [x] The round trip is lossless; the list `meta`, start number and block tunes are dropped before sending; a checklist goes out as an unordered list.
- [x] `youtubeVideoId` reads watch, youtu.be, embed, shorts, live and nocookie links (the API's rules) and refuses other hosts, short ids, channels and non-http schemes; the paste pattern matches YouTube links only.

**`editor/draft-autosave.ts` → `draft-autosave.spec.ts`** (fake `setTimeout`; real `ArticlesService` + `HttpTestingController`)
- [x] Waits for the delay after the last change, then sends only the changed fields and the revision; the next save uses the revision the last one returned.
- [x] One request at a time: a change made while saving goes with the next save (at once if the delay ran out meanwhile, after the delay otherwise).
- [x] A field with an error waits (status `invalid`) while the others are saved; nothing is sent when every changed field has an error.
- [x] A failed save keeps the changes (status `error`, translated fallback) and "Try again" resends them; a 409 stops autosave for good with the API's message; `save()` with nothing changed answers true without a request.

**`pages/content/articles/*` → `articles.spec.ts`** (`RouterTestingHarness`, the real Editor.js in jsdom with `matchMedia` and `<dialog>` stubbed; the autosave delay is the `AUTOSAVE_DELAY` token, 20 ms here)
- [x] List: rows with status, "Unpublished changes", category names and "(untitled)"; the count; the status filter and the debounced search go to the API; "Show more" adds the next page, and is usable again when a filter change cancels it (review of theindex-front#80); the empty, filtered-empty, no-match and error states.
- [x] New article: nothing sent without a title; `POST {title}` trimmed → the editor; an API error shows and gives the button back.
- [x] Editor load: title, body text, slug, excerpt, categories, featured image (by `GET /api/media/:id`), status and "Set at the first publish"; a load error and a missing id.
- [x] Autosave from the page: changed text fields only, trimmed, empty optional ones as `null`; the body as stored blocks after an edit (Editor.js batches its change events for 400 ms); a field over its limit waits with its error; a refused slug format; the whole category list; image and video blocks shown from their ids and saved back unchanged.
- [x] Media picker through the featured image: choose from the library (`Use this image` disabled until a choice), remove; upload with required file and alt text (multipart body), an API refusal shown in the dialog; closing the picker cancels an upload on its way, so it can't fill the next session (review of theindex-front#80).
- [x] A published article has no slug field and shows `/articles/<slug>`; a slug waiting with an error is dropped once a save shows the article was published meanwhile.
- [x] 409 → the API message, no more saves, "Reload the article" loads it again; a 500 → "Couldn't save" + "Try again"; a language switch rebuilds Editor.js with the text kept and the new placeholder.
- [x] Leaving: the guard saves at once and then leaves; when that save fails it asks (`window.confirm`) and stays on "no".
- [x] Routes (`app.routes.spec.ts`): `content/articles` and `content/articles/new` are ADMIN pages in the shell; the editor `content/articles/:id` is outside the shell with `authGuard` + `roleGuard` (ADMIN) and the leave guard, after the shell so `new` matches first; `/content` → `/content/articles`; a trainer gets `/unauthorized`, a signed-out visitor `/login`.

### 15. Content: publishing an article (P1)

**`services/articles.service.ts` → `articles.service.spec.ts`**
- [x] `publish {baseRevision}`, `unpublish {}`, `discardDraft {baseRevision}`, `delete`, `createPreviewToken {}` on the article's URLs.

**`pages/content/articles/editor/article-content.ts` → `article-content.spec.ts`**
- [x] `blocksKey` is the same for content that reads the same (ids, `time`, `version` and key order ignored) and differs for a text, a heading level or the block order; the quote tool's `alignment` is dropped before sending.

**`pages/content/articles/article-editor.component.ts` → `article-lifecycle.spec.ts`** (same setup as `articles.spec.ts`; `window.open` stubbed with a fake tab)
- [x] Publish: sends the revision the page has; "Publishing..." and disabled meanwhile; then the success notice with "View on site" (`environment.publicSiteUrl`), status Published, no slug field, Update disabled, Unpublish instead of Delete.
- [x] A change waiting for autosave is saved first, and its revision published; a body edit made within Editor.js's 400 ms batching is read and saved before publishing, and leaving saves it too (review of theindex-front#81); a field with an error publishes nothing and says so.
- [x] A 400 lists every problem under a heading and gives the button back; Dismiss clears it. A 409 shows the API message.
- [x] Update on a changed published article; "unpublished changes" stays when the draft was saved again while publishing; "Publish again" for an unpublished one.
- [x] Preview opens the tab in the click (`opener` cleared), then sends it to `/preview?token=…`; a failed token closes the tab and shows the fallback.
- [x] Unpublish waits for an autosave on its way; a save sent during the unpublish that answers after it keeps the new status and takes only its newer draft (review of theindex-front#81).
- [x] Unpublish, Discard and Delete each ask first (title and consequence shown), and Cancel or Escape sends nothing. Unpublish → Unpublished, "Publish again", Delete offered. Discard → the editor shows the live version and autosave continues from the new revision. Delete → `/content/articles`; a refused delete shows the API message and stays.

**`articles.spec.ts`**
- [x] An Editor.js change event that leaves the text as it was sends nothing and the status stays Saved.
- [x] The Editor.js edits wait for `requestIdleCallback` and poll for the save, instead of fixed sleeps that failed under the full suite's load.

---

### 16. Renewals (P1)

**`services/subscription-renewals.service.ts` → `subscription-renewals.service.spec.ts`**
- [x] `overview()` GETs `/api/subscription-renewals` with no params and passes the answer through.

**`pages/renewals/renewals.component.ts` → `renewals.component.spec.ts`**
- [x] Punch tab first: "Used up" then "Active", in the API's order, with the plan (plus "· N subscriptions" when several run), unpaid trainings or trainings left, and the last training; the mobile rows carry the same figure as a chip.
- [x] The time tab shows "Expired" (ended on, days ago, unpaid) and "Active" (ends on, days left, "Ends today" at 0) without asking the API again.
- [x] Every name links to `/trainees/:id`; an empty section says so; an API error shows its message and "Try again" reloads; Bulgarian plurals.

**`app.routes.spec.ts`, `navigation.spec.ts`**
- [x] `/renewals` is for ADMIN and TRAINER (a trainee goes to `/my-profile`); the menu item sits right under Dashboard, and on phones first in the More sheet.

---

## Part B — E2E user journeys (Playwright)

### B0. Setup ✅ (PR 5, together with J1 and J2)

- [x] Add `@playwright/test` (a dev dependency), `playwright.config.ts` and `e2e/`.
  - `webServer`: `ng serve` on :4200.
  - Projects:
    - `desktop`: Chromium, 1280×800;
    - `mobile`: Chromium, 390×844, touch.
  - Journeys say which projects they run in.
- [x] **API strategy:** mock at the network boundary with `page.route('**/api/**')`.
  - A small `ApiMock` holds fixtures shaped like theindex-api DTOs.
  - It **records every request** (method, URL, query, JSON body) so tests can assert the calls listed below.
  - It **fails the test on any unmocked `/api` call**.
  - Why: CI-friendly, deterministic, and doesn't need the sibling repo and Postgres. The risk is fixture drift from the real API. It is mitigated by an optional `@real-api` smoke tag that runs J1 against a local theindex-api (seeded `admin`/`admin`); see "Open questions".
- [x] **Clock:** `timezoneId: 'Europe/Sofia'` is set in the config. Journeys that check date defaults (J3, J5, J6) pin the time with `page.clock.setFixedTime('2026-11-02T10:00:00+02:00')`.
- [x] **Auth helpers:**
  - `loginViaUi(role)` is used by J1 only;
  - every other journey uses `signInAs(page, role, claims)`, which seeds `localStorage.accessToken` with a fake JWT through `addInitScript`.
- [x] **Language:**
  - default fixture: seed `localStorage.lang='en'`;
  - `t(key, params?)` reads `public/i18n/en.json` and formats ICU, so selectors use `getByRole('button', { name: t('plans.create.submit') })` and not literal text;
  - J8 also runs one check in Bulgarian, using `bg.json`.
- [x] **Dialogs:** handle `window.confirm` with `page.once('dialog')`. Assert the message and accept or dismiss (J4, J5, J6).
- [x] **`data-testid`s to add** (the only allowed production change; add them in the setup PR):
  - `cash-register-balance` (the balance value);
  - `attendance-summary-sessions`, `-attendance`, `-paid`, `-unpaid`, `-total` (summary values);
  - `list-count` on each `.list-toolbar__count`;
  - `settlement-status` (the status value on the details page).
  - Everything else is reachable by role, label or accessible name. Recheck while writing each journey and extend this list rather than using a CSS selector.
- [x] `npm run e2e` script, plus an E2E job in CI. It started in a separate `ci.yml`; PR 6 moved both test jobs into `docker-ghcr.yml`, where they gate the deploy.

**As built** (details in CLAUDE.md, "E2E layout"):
- `@playwright/test` is pinned to 1.63.0, the version of the Chromium preinstalled in the dev environment; CI installs its own.
- Test files are `e2e/**/*.e2e.ts`. The `desktop` and `mobile` projects select tests by the `@desktop` / `@mobile` tags.
- `ApiMock` fails a test on any `/api` request it doesn't answer. This was checked by removing two mocks from J1: the test failed and named both requests.
- `signInAs` / `seedToken` seed `localStorage` once per tab (a `sessionStorage` flag), so logging out or a 401 isn't undone by the next reload.
- The CI `e2e` job runs both projects and uploads the HTML report when it fails.
- Mutation check: 7 deliberate breaks in production code, each failing a journey:
  - J2: the Trainers nav item shown to every role;
  - J3: the optional time always sent;
  - J5: the paid amount sent in euros;
  - J6: a trainer given admin rights on settlements;
  - J7: cents truncated instead of rounded. J7 first missed this: 12.34 converts exactly, so it now pays 19.99;
  - J8: the language choice not saved;
  - J9: the S1 fix reverted.

Every journey starts with `GET /api/health` on boot. It is mocked as `{status:'ok'}` and not repeated below.

### J1. Staff sign-in with forced first password change (P0) [desktop, mobile]
✅ Done in PR 5: `e2e/journeys/j1-sign-in.e2e.ts`, 4 tests × 2 viewports.
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
✅ Done in PR 5: `e2e/journeys/j2-access-control.e2e.ts`, 7 tests. Step 3 also checks `/settlements` for a trainee.
1. No token, deep link `/trainees` → `/login`. No `/api/trainees` call.
2. TRAINER token:
   - the sidebar has no Trainers and no Cash register;
   - the sidebar has no Content either (added with J11);
   - `/trainers` → `/unauthorized`, and so do `/cash-register`, `/settlements/new` and `/content/categories`;
   - `/settlements` loads with no generate action.
3. TRAINEE token: `/home` → `/my-profile`, and `/trainees` → `/my-profile`.
4. Any token, `/login` → the role's home (`loginGuard`).
5. Session expiry: an ADMIN on `/trainees` gets `GET /api/trainees` → 401.
   - The token is removed and the app is on `/login`.
   - Reload stays on `/login`.
6. Log out from the user block → `/login`, token gone. Browser Back → still `/login` (`authGuard`).
7. Characterization: a token with a past `exp` is let in, and the first API 401 logs the user out (S6).

### J3. Register attendance as a trainer on a phone (P0) [mobile, plus a desktop smoke run]
✅ Done in PR 5: `e2e/journeys/j3-register-attendance.e2e.ts`, 3 tests. The trainer, gym and date are preselected; the training-time options are sorted.
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
✅ Done in PR 5: `e2e/journeys/j4-attendance-history.e2e.ts`, 3 tests.
1. ADMIN token, `/attendance` → `GET /api/trainers?active=true` and `GET /api/attendance/sessions?startDate=…&endDate=…`, with no `trainerId`.
2. Every session chip is pressed (`aria-pressed=true`), newest session first (the fixture is oldest first, like the API). The summary testids show the totals over all sessions; the price total counts final prices only.
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
✅ Done in PR 5: `e2e/journeys/j5-trainee-onboarding.e2e.ts`, 1 test running the whole flow against a stateful fake API.
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
✅ Done in PR 5: `e2e/journeys/j6-settlements.e2e.ts`, 3 tests.
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
✅ Done in PR 5: `e2e/journeys/j7-cash-register.e2e.ts`, 3 tests × 2 viewports.
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
✅ Done in PR 5: `e2e/journeys/j8-trainee-self-service.e2e.ts`, 4 tests. The More tab's "current" state is CSS-only and can't be asserted (S17).
Since the trainings calendar, the phone test fixes the clock to 31 Oct 2026 so its October training is in the month the calendar opens on.
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
✅ Done in PR 5: `e2e/journeys/j9-plans.e2e.ts`, 2 tests.
1. ADMIN token. `/plans` → `GET /api/plans`. The Active filter → `GET /api/plans?active=true`; Inactive → `active=false`.
2. "New plan":
   - type Punch card, so credits are required (an empty value shows an error);
   - title "10 visits", price 45.5, credits 10;
   - save → `POST /api/plans {type:'PUNCH', title:'10 visits', priceCents:4550, isActive:true, credits:10}` (no `durationDays` key) → the app lands on `/plans`.
3. Open the plan → `GET /api/plans/<id>`. Edit:
   - switch to Time-based; credits is cleared and duration is required;
   - set 30 days and save → `PATCH /api/plans/<id> {type:'TIME', title, priceCents, isActive, credits:null, durationDays:30}`.
4. Deactivate → `DELETE /api/plans/<id>` → `/plans`.
5. Variant: the POST → 400. The API message shows in an alert, and the save button is enabled again (S1, fixed in PR 3).

### J10. Trainings calendar (P1) [desktop, mobile]
✅ Added with the calendar: `e2e/journeys/j10-trainings-calendar.e2e.ts`, 2 tests. The clock is fixed to 3 Nov 2026 (`page.clock.setFixedTime`).
1. Desktop, TRAINEE on `/my-profile`: Calendar is checked, the month is November 2026, today is `aria-current="date"`, Today is disabled, and the legend names unpaid trainings.
2. Previous month → October: the summary counts the month; a cell shows time, trainer and gym of each training.
3. Opening a day lists its trainings with their payment status; "Clear selection" clears it.
4. Keyboard: ArrowDown and PageDown move focus between days and months.
5. Next month is allowed and empty; Today comes back.
6. List shows every training in the table and is still chosen after a reload; switching back shows the calendar.
7. Phone: cells show markers only (no trainer text); the month is listed below the grid by day; tapping a day narrows the list to it.

### J11. Content categories (P1) [desktop, mobile]
✅ Added with the categories pages (theindex-web backlog item 9): `e2e/journeys/j11-content-categories.e2e.ts`, 2 tests.
1. Desktop, ADMIN on `/home`: "Content" in the sidebar → `/content/articles` (since item 10), then the "Categories" tab → `/content/categories`, the tab is `aria-current="page"`, the count shows 1.
2. "New category" with only a name → `POST /api/article-categories {name}` → back on the list, which now counts 2.
3. Open it → the edit page with its slug. A slug the API refuses (409) shows the message in an alert. A free slug and a description → `PATCH {name, slug, description, sortOrder}` → the list.
4. Open it again → "Delete category" → the warning → confirm → `DELETE` → the list.
5. Phone: More → Content in the sheet → the categories as rows; a row opens the edit page.

### J12. Content articles (P1) [desktop, mobile]
✅ Added with the article list and editor (theindex-web backlog item 10): `e2e/journeys/j12-content-articles.e2e.ts`, 2 tests. The mock answers autosaves like the API (merges the changes, counts the revision up, 409 on a stale one).
1. Desktop: "Content" → `/content/articles`, three rows; the "Live" filter → `GET /api/articles?status=PUBLISHED&page=1&pageSize=20`.
2. "New article" → title → `POST {title}` → the full-screen editor (no app navigation) with the title and "Saved".
3. Typing in the body → one autosave with the paragraph block. Enter, "/" in the new block (after the browser is idle: Editor.js wires new blocks up then), filter "YouTube", the link field → an `embed` block with the video id.
4. Settings: excerpt and a category → saved together, only those fields. Featured image from the library, then an upload (alt text required first; multipart body with the file name and alt text).
5. Change the title and click "Articles": the leave guard saves it first, then the list opens.
6. Phone: a row of the list opens the editor; the settings panel follows the text; an SEO title → one autosave with only that field.

### J13. Content publishing (P1) [desktop, mobile]
✅ Added with the publishing actions (theindex-web backlog item 11): `e2e/journeys/j13-content-publishing.e2e.ts`, 2 tests. `e2e/support/article-api.ts` answers the editor like the API: autosave, publish with its rules (400 with a list), unpublish, discard, delete (409 while published) and preview tokens.
1. Desktop: a draft without a title → Publish → the problem is listed. A title → Publish → that revision is published; "View on site" links to the site; Update is disabled.
2. Preview opens a new tab at `http://localhost:4321/preview?token=tok-1` (the dev `publicSiteUrl`, answered by a route).
3. An excerpt → Update enabled, "unpublished changes" → Update → published.
4. Unpublish: the dialog explains it; Cancel sends nothing; confirm → Unpublished, "Publish again".
5. Delete permanently: Cancel has the focus; confirm → `DELETE` → the list.
6. Phone: Discard changes on a changed published article → confirm → the editor shows the live title.


### J14. Renewals (P1) [desktop, mobile]
✅ Added with the renewals page: `e2e/journeys/j14-renewals.e2e.ts`, 2 tests.
1. Desktop, trainer: the second menu link is Renewals; it opens `/renewals`. The punch tables list used up and active trainees in the API's order; the Time option shows expired ("9 days ago") and active ("10 days"); the overview is loaded once; names link to the trainee.
2. Phone, admin: Renewals is the first link in the More sheet; the used-up list shows the unpaid chip.

### J15. Workouts (P1) [desktop, mobile]
✅ Added with the workouts area: `e2e/journeys/j15-workouts.e2e.ts`, 3 tests (4 runs).
1. Desktop and phone, trainer: an empty day of the week opens the form on that day; a PDF fills it (the API's draft is mocked); the movement the catalogue lacks is created from the form; nothing is saved until "Create workout", which posts the whole workout and returns to the week.
2. Desktop, trainer: the sidebar leads to Workouts, its tabs to Exercises and Types.
3. Desktop, trainee: `/workouts` is out of reach and loads nothing.
---

## Suspected unintended behavior (to characterize, then log in `TEST_NOTES.md`)

These come from reading the code. Each gets a `// CHARACTERIZATION: possibly unintended` test pinning today's behavior. Copy the entry to `TEST_NOTES.md` when its test lands. Nothing here gets fixed in the test PRs.

- **S1 — Form errors don't render (zoneless).** ✅ Fixed in PR 3. Confirmed with a throwaway probe spec on plan-create (not committed).
  - Some create, edit and delete handlers set `errorMessage`/`submitting` in the HTTP callback without `detectChanges()`. A failed save then shows nothing, and the submit button stays disabled on "Saving..." until the user interacts again.
  - Affected pages:
    - create, edit and delete for plans, gyms, gym subscriptions, training times and trainers;
    - create, edit and delete for trainees;
    - the subscription sale on trainee details.
  - The same handlers call `router.navigate` on success, so success looks fine.
- **S2 — Subscription start date is UTC.** ✅ Fixed in PR 3. Trainee details defaults `startsAt` to the UTC date. Between 00:00 and 02:00/03:00 Sofia time it is yesterday. Register attendance and settlements use the local date.
- **S3 — Subscriptions on inactive plans show an id.** Trainee details loads only active plans, so a subscription on a deactivated plan shows its raw `planId` as the plan name.
- **S4 — Stale report data.** On Home, inactive-report requests aren't cancelled when the selection changes; a slow earlier response can overwrite a newer one.
- **S5 — Invisible success notice.** Change password sets the success notice and navigates away immediately, so it is never seen.
- **S6 — No expiry check.** `isAuthenticated()` ignores `exp`. Guards admit expired tokens until the first API 401. Low impact, but it is how sessions behave.
- **S7 — Blank plan titles pass validation.** A whitespace-only plan title passes and is sent as `''`. The other forms use `trimmedLength`.
- **S8 — A failed account load allows a second account.** On the trainee/trainer account page, a failed or `null` account GET for a linked profile falls back to "create account" mode.
- **S9 — Trainer without a profile sees all sessions.** A TRAINER token without `trainerProfileId` gets unfiltered attendance history (but can't delete anything).
- **S10 — Allocations capped at 500.** Settlement allocations stop at 500 rows with no paging.
- **S17 — The More/Account tab's "current page" state is visual only** (found in PR 5). It is shown with a CSS class only; there is no `aria-current`.
- **S11 / S12 — No range checks.** Settlement generate and training times have no client-side range check (start ≤ end); only the API validates.
- **S13 — Login can be submitted twice.** The submit button isn't disabled while signing in, so a double click sends two login requests (found while writing §2).
- **S14 — A whitespace-only phone silently blocks the first password change.** "   " passes `Validators.required`, so no error shows, then the submit handler trims it to nothing and returns without a word (found while writing §2).
- **S15 — An inactive trainer or trainee can be deactivated again** (found in PR 4). Plans, gyms and gym subscriptions disable the button for an inactive record; these two pages don't.
- **S16 — The trainee dashboard never shows its page-level error** (found in PR 4). The error block renders only `@if (errorMessage && loading)`, which is never true. With no `traineeProfileId`, the trainee sees "No active subscriptions" instead of the missing-profile message.
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

### Decisions (owner, 2 Nov 2026)
- [x] **CI:** a separate PR-check workflow (`.github/workflows/ci.yml`) runs unit tests and the production build on every pull request. E2E joins it once Part B lands. The deploy workflow is untouched. To block merges on red checks, make the check required in branch protection for `main`.
  - Superseded on 3 Nov 2026 (owner): deploy must depend on the tests, as in theindex-api. PR 6 merged `ci.yml` into `docker-ghcr.yml`: `test-and-build` and `e2e` run on every PR and push to `main`, and `build-front` and `deploy` need both and are skipped for PRs. The check names are unchanged, so branch protection keeps working.
- [x] **Real-API E2E:** not now. Revisit when theindex-api has its own compose setup.
- [x] **Fixes:** S1 and S2 were fixed in PR 3, test-first.

### Decisions (owner, 3 Nov 2026)
- [x] **Fixes are on hold.** This repo now works like theindex-api: the test PRs record findings in `TEST_NOTES.md` and update this plan, and propose no fixes. When a fix is taken up later, it follows the CLAUDE.md rule: flip the characterization test first, then change the code.

## Order of work
1. [x] Shared test helpers and §1 (access control). PR 2.
2. [x] §2 and §3 (sign-in and money), then §4 (attendance). PR 2.
3. [x] §5–§12: services, pages, i18n, utils and shared components. PR 4.
4. [x] E2E setup (B0) with the `data-testid` additions, and journeys J1–J9. PR 5.

E2E findings go in `TEST_NOTES.md` the same way: characterize, don't fix.
