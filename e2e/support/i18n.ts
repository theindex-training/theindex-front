import MessageFormat from '@messageformat/core';
import bg from '../../public/i18n/bg.json';
import en from '../../public/i18n/en.json';

type Tree = { [key: string]: string | Tree };

function lookup(tree: Tree, key: string): string {
  const value = key
    .split('.')
    .reduce<string | Tree | undefined>(
      (node, part) => (typeof node === 'object' ? node[part] : undefined),
      tree,
    );
  if (typeof value !== 'string') {
    throw new Error(`Missing translation key: ${key}`);
  }
  return value;
}

const formatters = { en: new MessageFormat('en'), bg: new MessageFormat('bg') };

/**
 * The text the app shows for a translation key, in English (ICU plurals and params included).
 * Selectors use it instead of literal copy: a reworded label doesn't break a test, a missing one does.
 */
export function t(key: string, params: Record<string, unknown> = {}): string {
  return formatters.en.compile(lookup(en, key))(params);
}

/** Same as t(), in Bulgarian. */
export function tBg(key: string, params: Record<string, unknown> = {}): string {
  return formatters.bg.compile(lookup(bg, key))(params);
}
