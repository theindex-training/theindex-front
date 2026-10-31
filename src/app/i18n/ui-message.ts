/** Values for a translation's {placeholders}, e.g. { count: 3 }. */
export type TranslationParams = Record<string, unknown>;

/**
 * Text that a component stores and shows later (errors, success notices). A `key` is translated when
 * rendered, so it follows language switches; `text` is shown as is (messages from the API, which
 * come in English). Render with the `uiMessage` pipe.
 */
export type UiMessage = { key: string; params?: TranslationParams } | { text: string };

export function i18nMessage(key: string, params?: TranslationParams): UiMessage {
  return { key, params };
}

/** The API's own message when it sent one (a NestJS error body), otherwise a translated fallback. */
export function apiErrorMessage(error: unknown, fallbackKey: string, params?: TranslationParams): UiMessage {
  const message = (error as { error?: { message?: unknown } } | null)?.error?.message;
  if (typeof message === 'string' && message.trim()) {
    return { text: message };
  }
  if (Array.isArray(message) && message.length) {
    return { text: message.join(', ') };
  }
  return { key: fallbackKey, params };
}
