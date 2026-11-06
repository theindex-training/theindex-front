import { CanDeactivateFn } from '@angular/router';

/** A page that may still be saving when the user leaves it. */
export interface LeavesSafely {
  /** Resolves false to stay on the page. */
  canLeave(): Promise<boolean>;
}

/**
 * Leaving the article editor (a link, Back, a route change) waits for the last autosave, and asks
 * first when it can't save. Kept apart from the editor, so the route table doesn't pull Editor.js
 * into the initial bundle.
 */
export const leaveEditorGuard: CanDeactivateFn<LeavesSafely> = (component) =>
  component.canLeave();
