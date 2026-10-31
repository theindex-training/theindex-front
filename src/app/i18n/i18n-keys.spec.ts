import MessageFormat from '@messageformat/core';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import bg from '../../../public/i18n/bg.json';
import en from '../../../public/i18n/en.json';
import { ENUM_VALUES, enumLabelKey } from './enum-labels';

type Tree = { [key: string]: string | Tree };

/** Flattens { a: { b: 'x' } } to { 'a.b': 'x' }. */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix + key;
    return typeof value === 'string'
      ? { ...flat, [path]: value }
      : { ...flat, ...flatten(value, `${path}.`) };
  }, {});
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

const enKeys = flatten(en as Tree);
const bgKeys = flatten(bg as Tree);
const namespaces = Object.keys(en);

/**
 * Every quoted string in a template or component that looks like a translation key: it starts with a
 * top-level namespace of the language files ('common.', 'trainees.', …) and is a plain dotted path.
 * Keys built at runtime (`enums.planType.${type}`) can't be checked here; enum keys are covered by
 * the ENUM_VALUES test below.
 */
function keysUsedInSource(): Map<string, string[]> {
  const pattern = new RegExp(`['"\`]((?:${namespaces.join('|')})\\.[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)*)['"\`]`, 'g');
  const used = new Map<string, string[]>();
  for (const file of sourceFiles('src/app')) {
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      used.set(match[1], [...(used.get(match[1]) ?? []), file]);
    }
  }
  return used;
}

describe('translation files', () => {
  it('bg.json and en.json have exactly the same keys', () => {
    const onlyInEn = Object.keys(enKeys).filter(key => !(key in bgKeys));
    const onlyInBg = Object.keys(bgKeys).filter(key => !(key in enKeys));

    expect(onlyInEn, 'keys missing from bg.json').toEqual([]);
    expect(onlyInBg, 'keys missing from en.json').toEqual([]);
  });

  it('has no empty translations', () => {
    const empty = [...Object.entries(enKeys), ...Object.entries(bgKeys)]
      .filter(([, value]) => !value.trim())
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });

  it('defines every key used in templates and components', () => {
    const used = keysUsedInSource();
    const missing = [...used.entries()]
      .filter(([key]) => !(key in enKeys) || !(key in bgKeys))
      .map(([key, files]) => `${key} (${files.map(file => file.replace('src/app/', '')).join(', ')})`);

    expect(used.size).toBeGreaterThan(300);
    expect(missing, 'keys used in src/app but missing from the language files').toEqual([]);
  });

  it('labels every API enum value in both languages', () => {
    const missing = Object.entries(ENUM_VALUES).flatMap(([group, values]) =>
      values
        .map(value => enumLabelKey(group as keyof typeof ENUM_VALUES, value))
        .filter(key => !(key in enKeys) || !(key in bgKeys))
    );

    expect(missing).toEqual([]);
  });

  it('contains only valid ICU messages', () => {
    const invalid: string[] = [];
    for (const [lang, keys] of [['en', enKeys], ['bg', bgKeys]] as const) {
      const messageFormat = new MessageFormat(lang);
      for (const [key, value] of Object.entries(keys)) {
        try {
          messageFormat.compile(value);
        } catch (error) {
          invalid.push(`${lang}:${key}: ${(error as Error).message}`);
        }
      }
    }

    expect(invalid).toEqual([]);
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (value: string) =>
      // {name} or {count, plural, …}, but not plural branches such as "one {selected}".
      [...value.matchAll(/(?<!(?:zero|one|two|few|many|other|=\d+)\s)\{(\w+)[,}]/g)]
        .map(match => match[1])
        .sort()
        .join(',');
    const mismatched = Object.keys(enKeys).filter(
      key => key in bgKeys && placeholders(enKeys[key]) !== placeholders(bgKeys[key])
    );

    expect(mismatched).toEqual([]);
  });
});
