# Test notes

Behavior that characterization tests pinned but that looks unintended. Each entry matches a `// CHARACTERIZATION: possibly unintended` comment in a spec. See "Testing" in `CLAUDE.md`.

Entry format: **ID — title**, then:
- **Where:** file and function.
- **Behavior:** what happens today.
- **Why it looks wrong:** the reason.
- **Pinned by:** the spec file and test name.
- **Status:** open, fixed in a PR, or confirmed intended.

IDs match "Suspected unintended behavior" in `TEST_PLAN.md`. Entries are in ID order.

---

## S1 — A failed save shows nothing and leaves the button on "Saving..."
- **Where:** the HTTP `error` handlers of 19 submit methods. They set `errorMessage`/`submitting` but never call `detectChanges()`. Affected:
  - create, edit and delete pages for plans, gyms, gym subscriptions, training times, trainers and trainees;
  - `TraineeDetailsComponent.handleCreateSubscription`.
- **Behavior:** the app is zoneless, so nothing re-renders after the callback. The alert never appears and the submit button stays disabled on "Saving..." / "Purchasing...", until some other event (typing, a click) triggers a render.
- **Why it looks wrong:** the user gets no feedback that the save failed, and the page looks stuck. Other pages (cash register, attendance register, accounts) call `detectChanges()` in the same place and work.
- **Pinned by:**
  - `pages/save-errors.spec.ts`: one row per handler (18 of them). Each row fails the save and checks that the API message shows and the button is enabled with its normal label.
  - `trainee-details.component.spec.ts` › "shows a failed sale and gives the button back".
  - `plan-create` / `plan-edit` specs › "shows a failed save and gives the button back".
- **Status:** **fixed in PR 3.** Each of the 19 error handlers now calls `detectChanges()`, the codebase's convention for async updates. The five create pages that had no `ChangeDetectorRef` now inject one. Before the fix, every test above failed on the missing alert.

## S2 — Subscription start date defaults to the UTC date
- **Where:** `TraineeDetailsComponent.todayString()` (`new Date().toISOString().slice(0, 10)`).
- **Behavior:** between 00:00 and 02:00 (03:00 in summer) Sofia time, the default "Starts" date is yesterday.
- **Why it looks wrong:** Register attendance and Generate settlement use the local date. A subscription sold just after midnight would start a day early unless the trainer notices.
- **Pinned by:** `trainee-details.component.spec.ts`:
  - "defaults the start date to today's local date" (00:30 Sofia time, with a faked Date);
  - the reset after a sale, in "sells the subscription…".
- **Status:** **fixed in PR 3.** `todayString()` now builds the date from local fields, like Register attendance. Both tests failed before the fix.

## S3 — Subscriptions on a deactivated plan show the plan id
- **Where:** `TraineeDetailsComponent.loadPlans()` loads `GET /api/plans?active=true`; `formatPlanLabel()` falls back to `planId`.
- **Behavior:** a subscription whose plan has since been deactivated is listed under its raw id (e.g. a UUID) instead of the plan title.
- **Why it looks wrong:** deactivating a plan shouldn't make the history of existing subscriptions unreadable. The trainee's own dashboard loads all plans and shows the title.
- **Pinned by:** `trainee-details.component.spec.ts` › "names a subscription on a deactivated plan by its raw plan id".
- **Status:** open. Planned: load all plans for names, offer only active ones in the picker.

## S4 — The inactive-trainees report can show stale results
- **Where:** `HomeComponent.loadInactiveReport()`: each change of "Inactive for" starts a new request, and older requests are not cancelled.
- **Behavior:** pick 30 days and then 90 days. If the 30-day answer arrives last, it replaces the 90-day report while the selector still says 90 days.
- **Why it looks wrong:** what the report shows no longer matches the selection, and nothing indicates it.
- **Pinned by:** `home.component.spec.ts` › "shows the newest answer only if it arrives last".
- **Status:** open. Planned: cancel the previous request (`switchMap`).

## S5 — The "password updated" notice is never seen
- **Where:** `ChangePasswordComponent.handleSubmit()` success handler.
- **Behavior:** it sets `successMessage` and then immediately navigates to the home page, which destroys the component.
- **Why it looks wrong:** dead code; the user gets no confirmation that the change worked.
- **Pinned by:** `change-password.component.spec.ts` › "resets the form and navigates away on success, so the success notice is never seen".
- **Status:** open. Planned: remove the dead message (or show it on the next page; decide in the fix PR).

## S6 — Expired tokens count as signed in
- **Where:** `AuthService.isAuthenticated()`, used by `authGuard`, `loginGuard` and `roleGuard`.
- **Behavior:** any stored token passes; `exp` is never checked. The first API call then returns 401, and the interceptor logs the user out.
- **Why it looks wrong:** the shell renders briefly for an expired session. Low impact: the API is the real gate.
- **Pinned by:** `auth.service.spec.ts` › "accepts an expired token" (and "accepts any stored string…").
- **Status:** open. Recommendation: keep as is (agreed with the owner).

## S7 — A plan title of only spaces is accepted
- **Where:** `PlanCreateComponent` / `PlanEditComponent` form: `title` has only `Validators.required`.
- **Behavior:** "   " passes validation and is sent as `title: ''`.
- **Why it looks wrong:** every other text field uses `trimmedLength`. A blank title either fails at the API with a raw message or creates a nameless plan.
- **Pinned by:** `plan-create.component.spec.ts` › "accepts a title of only spaces and sends it as an empty string".
- **Status:** open. Planned: `trimmedLength` with the API's limits.

## S8 — A failed account load offers to create a second account
- **Where:** `TraineeAccountComponent` / `TrainerAccountComponent.loadExistingAccount()`.
- **Behavior:** the profile has an `accountId`, but `GET /api/accounts/<id>` fails or returns `null`. The page then stays in "Create account" mode, and saving POSTs a new account for the profile. In the `null` case the password validators are already cleared, so even a blank password would be sent.
- **Why it looks wrong:** it can create a second login for one person, or fail at the API with a confusing message, instead of saying the account couldn't be loaded.
- **Pinned by:** `account-pages.spec.ts` › "falls back to "create" when the linked account cannot be loaded" (trainee and trainer, error and `null`).
- **Status:** open. Planned: show a load error instead of create mode.

## S9 — A trainer without a trainer profile sees every trainer's sessions
- **Where:** `AttendanceSessionsComponent.loadSessions()`: `trainerId` is taken from the token's `trainerProfileId`, and the filter is dropped when that is null.
- **Behavior:** such a trainer's attendance history is unfiltered, showing all trainers. They can't delete anything.
- **Why it looks wrong:** trainers otherwise only see their own sessions. Whether the API filters by role is unknown; check theindex-api.
- **Pinned by:** `attendance-sessions.component.spec.ts` › "without a trainer profile, loads every trainer's sessions but can delete nothing".
- **Status:** open. Needs a cross-repo check.

## S10 — Settlement allocations stop at 500 rows
- **Where:** `SettlementDetailsComponent.loadAllocations()` asks for `offset=0&limit=500` only.
- **Behavior:** a report with more rows shows the first 500 and "Showing 500 of N rows", with no way to see the rest.
- **Why it looks wrong:** part of a payout breakdown is unreachable. It only matters once a single settlement has more than 500 allocations.
- **Pinned by:** `settlement-details.component.spec.ts` › "shows at most 500 allocation rows, with no way to see the rest".
- **Status:** open, deferred (agreed with the owner).

## S11 — A settlement period can end before it starts
- **Where:** `SettlementGenerateComponent.generateSettlement()` checks only that both dates are filled.
- **Behavior:** start 31 Oct and end 1 Oct is sent to the API as is.
- **Why it looks wrong:** the user gets whatever the API says (or a nonsense report) instead of a clear form error.
- **Pinned by:** `settlement-generate.component.spec.ts` › "sends a period that ends before it starts".
- **Status:** open. Planned: a client-side check.

## S12 — A training time can end before it starts
- **Where:** training time create/edit forms: both times are only `Validators.required`.
- **Behavior:** 19:00 to 18:00 is sent to the API as is.
- **Why it looks wrong:** same as S11.
- **Pinned by:** `catalog-pages.spec.ts` › "accepts a training time that ends before it starts".
- **Status:** open. Planned: a client-side check.

## S13 — Login can be submitted twice
- **Where:** `login.component.html`: the submit button doesn't use `isSubmitting`.
- **Behavior:** a double click or a double Enter sends two `POST /api/auth/login` requests.
- **Why it looks wrong:** every other form disables its button while saving. It's harmless today (two tokens, the last one wins), but the page gives no "signing in" feedback either.
- **Pinned by:** `login.component.spec.ts` › "sends a second login request when submitted twice before the first answers".
- **Status:** open. Low priority.

## S14 — A phone number of only spaces silently blocks the first password change
- **Where:** `ChangePasswordComponent.handleSubmit()`.
- **Behavior:** `phone` uses `Validators.required`, which "   " passes, so no error shows. The method then trims the phone to `null`, marks it touched and returns. Nothing is sent and nothing on screen changes.
- **Why it looks wrong:** the user is stuck with no explanation.
- **Pinned by:** `change-password.component.spec.ts` › "silently does nothing when the phone is only spaces".
- **Status:** open. Planned: validate the trimmed value, so the existing phone error shows.

## S15 — An inactive trainer or trainee can be deactivated again
- **Where:** `trainer-delete` / `trainee-delete` templates. The confirm button is disabled only while saving.
- **Behavior:** for an already-inactive trainer or trainee, "Deactivate" stays enabled and sends `DELETE` again. Plans, gyms and gym subscriptions disable it and say the record is already inactive.
- **Why it looks wrong:** inconsistent with the other three pages. Harmless if the API treats the call as a no-op, but that's unverified.
- **Pinned by:** `catalog-pages.spec.ts` › "an inactive trainer/trainee can still be deactivated again".
- **Status:** open. Low priority (found in PR 4; not on the original fix list).

## S16 — The trainee dashboard never shows its page-level error
- **Where:** `trainee-dashboard.component.html`: the error state renders only `@if (errorMessage && loading)`. But both code paths set `loading = false` together with `errorMessage`.
- **Behavior:**
  - When loading fails, the page-level "Couldn't load your profile" state never appears. The two tables still show the error, so the user does see it.
  - When the token has no `traineeProfileId`, nothing shows the "missing profile" message at all. The trainee reads "No active subscriptions found for your profile" and "No trainings yet", as if their history were empty.
- **Why it looks wrong:** the condition can never be true, and in the missing-profile case it tells a trainee they have no subscriptions when the app just couldn't identify them.
- **Pinned by:** `trainee-dashboard.component.spec.ts` › "shows empty lists, not an explanation, for a token without a trainee profile" and "never shows the page-level error, even when loading fails".
- **Status:** open. Found in PR 4; proposed for the fix list.
