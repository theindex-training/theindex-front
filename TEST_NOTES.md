# Test notes

Behavior that characterization tests pinned but that looks unintended. Each entry matches a `// CHARACTERIZATION: possibly unintended` comment in a spec. See "Testing" in `CLAUDE.md`.

Entry format: **ID — title**, then:
- **Where:** file and function.
- **Behavior:** what happens today.
- **Why it looks wrong:** the reason.
- **Pinned by:** the spec file and test name.
- **Status:** open, fixed in a PR, or confirmed intended.

IDs match "Suspected unintended behavior" in `TEST_PLAN.md`. Gaps (S4, S8, S10–S12) are pinned in later PRs.

---

## S1 — A failed save shows nothing and leaves the button on "Saving..."
- **Where:** the HTTP `error` handlers of 19 submit methods. They set `errorMessage`/`submitting` but never call `detectChanges()`. Affected:
  - create, edit and delete pages for plans, gyms, gym subscriptions, training times, trainers and trainees;
  - `TraineeDetailsComponent.handleCreateSubscription`.
- **Behavior:** the app is zoneless, so nothing re-renders after the callback. The alert never appears and the submit button stays disabled on "Saving..." / "Purchasing...", until some other event (typing, a click) triggers a render.
- **Why it looks wrong:** the user gets no feedback that the save failed, and the page looks stuck. Other pages (cash register, attendance register, accounts) call `detectChanges()` in the same place and work.
- **Pinned by:**
  - `plan-create.component.spec.ts` › "does not show a failed save to the user";
  - `plan-edit.component.spec.ts` › same name;
  - `trainee-details.component.spec.ts` › "does not show a failed sale to the user".
  - The other 16 handlers get the same test in the §5/§7 PR.
- **Status:** open. Fix planned (PR 3).

## S2 — Subscription start date defaults to the UTC date
- **Where:** `TraineeDetailsComponent.todayString()` (`new Date().toISOString().slice(0, 10)`).
- **Behavior:** between 00:00 and 02:00 (03:00 in summer) Sofia time, the default "Starts" date is yesterday.
- **Why it looks wrong:** Register attendance and Generate settlement use the local date. A subscription sold just after midnight would start a day early unless the trainer notices.
- **Pinned by:** `trainee-details.component.spec.ts` › "defaults the start date to today's UTC date". The spec runs at 00:30 Sofia time, set in `src/test-providers.ts` and with a faked Date.
- **Status:** open. Fix planned (PR 3).

## S3 — Subscriptions on a deactivated plan show the plan id
- **Where:** `TraineeDetailsComponent.loadPlans()` loads `GET /api/plans?active=true`; `formatPlanLabel()` falls back to `planId`.
- **Behavior:** a subscription whose plan has since been deactivated is listed under its raw id (e.g. a UUID) instead of the plan title.
- **Why it looks wrong:** deactivating a plan shouldn't make the history of existing subscriptions unreadable. The trainee's own dashboard loads all plans and shows the title.
- **Pinned by:** `trainee-details.component.spec.ts` › "names a subscription on a deactivated plan by its raw plan id".
- **Status:** open. Planned: load all plans for names, offer only active ones in the picker.

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

## S9 — A trainer without a trainer profile sees every trainer's sessions
- **Where:** `AttendanceSessionsComponent.loadSessions()`: `trainerId` is taken from the token's `trainerProfileId`, and the filter is dropped when that is null.
- **Behavior:** such a trainer's attendance history is unfiltered, showing all trainers. They can't delete anything.
- **Why it looks wrong:** trainers otherwise only see their own sessions. Whether the API filters by role is unknown; check theindex-api.
- **Pinned by:** `attendance-sessions.component.spec.ts` › "without a trainer profile, loads every trainer's sessions but can delete nothing".
- **Status:** open. Needs a cross-repo check.

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
