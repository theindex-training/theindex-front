export function formatTimeWithoutSeconds(value: string): string {
  const [hours, minutes] = value.split(':');

  if (hours === undefined || minutes === undefined) {
    return value;
  }

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}
