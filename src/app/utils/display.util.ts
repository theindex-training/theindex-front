export function displayValue(value: string | null | undefined, fallback = '—'): string {
  return value?.trim() || fallback;
}
