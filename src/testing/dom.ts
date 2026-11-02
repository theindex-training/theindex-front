/**
 * Drives a rendered page the way a user would: type, pick, tick, submit, then wait for the zoneless
 * app to settle. Plain TypeScript (see jwt.ts for why). Works with a ComponentFixture
 * (`driver(() => fixture.nativeElement, () => fixture.whenStable())`) or a RouterTestingHarness
 * (`driver(() => harness.routeNativeElement!, () => harness.fixture.whenStable())`).
 */
export interface PageDriver {
  root(): HTMLElement;
  /** Waits for rendering, pending timers (router navigation) and rendering again. */
  settle(): Promise<void>;
  query<T extends Element = HTMLElement>(selector: string): T | null;
  queryAll<T extends Element = HTMLElement>(selector: string): T[];
  /** All visible text of the page, whitespace collapsed. */
  text(): string;
  /** Text of the first role="alert" element, trimmed; undefined when there is none. */
  alert(): string | undefined;
  type(selector: string, value: string): Promise<void>;
  select(selector: string, value: string): Promise<void>;
  check(selector: string, checked: boolean): Promise<void>;
  click(selector: string): Promise<void>;
  submit(selector?: string): Promise<void>;
}

export function driver(root: () => HTMLElement, whenStable: () => Promise<unknown>): PageDriver {
  const must = <T extends Element>(selector: string): T => {
    const element = root().querySelector<T>(selector);
    if (!element) {
      throw new Error(`No element matches ${selector}`);
    }
    return element;
  };

  const settle = async () => {
    await whenStable();
    await new Promise(resolve => setTimeout(resolve));
    await whenStable();
  };

  return {
    root,
    settle,
    query: selector => root().querySelector(selector),
    queryAll: selector => Array.from(root().querySelectorAll(selector)),
    text: () => (root().textContent ?? '').replace(/\s+/g, ' ').trim(),
    alert: () => root().querySelector('[role="alert"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    async type(selector, value) {
      const input = must<HTMLInputElement | HTMLTextAreaElement>(selector);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      await settle();
    },
    async select(selector, value) {
      const select = must<HTMLSelectElement>(selector);
      select.value = value;
      select.dispatchEvent(new Event('change'));
      await settle();
    },
    async check(selector, checked) {
      const input = must<HTMLInputElement>(selector);
      if (input.checked !== checked) {
        input.click();
      }
      await settle();
    },
    async click(selector) {
      must<HTMLElement>(selector).click();
      await settle();
    },
    async submit(selector = 'form') {
      must<HTMLFormElement>(selector).dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
    }
  };
}

/** Flushes an HTTP error the way theindex-api (NestJS) sends one. */
export function apiError(message?: string | string[], status = 400) {
  return {
    body: message === undefined ? null : { statusCode: status, message },
    options: { status, statusText: 'Error' }
  };
}
