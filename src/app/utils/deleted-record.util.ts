import { MonoTypeOperatorFunction, map } from 'rxjs';
import { UiMessage, apiErrorMessage, i18nMessage } from '../i18n/ui-message';

/**
 * Trainees, trainers, gyms, gym subscriptions and plans are deleted softly: the API only marks them
 * inactive. The app treats an inactive one as gone, so its pages answer "not found" for it.
 */
export class DeletedRecordError extends Error {
  constructor() {
    super('The record was deleted.');
    this.name = 'DeletedRecordError';
  }
}

/** Fails with a `DeletedRecordError` when the loaded record is inactive (deleted). */
export function rejectDeleted<
  T extends { isActive: boolean },
>(): MonoTypeOperatorFunction<T> {
  return map((record) => {
    if (!record.isActive) {
      throw new DeletedRecordError();
    }
    return record;
  });
}

/** The message for a failed load: `notFoundKey` for a deleted record, else the API's or `fallbackKey`. */
export function recordLoadError(
  error: unknown,
  notFoundKey: string,
  fallbackKey: string,
): UiMessage {
  return error instanceof DeletedRecordError
    ? i18nMessage(notFoundKey)
    : apiErrorMessage(error, fallbackKey);
}
