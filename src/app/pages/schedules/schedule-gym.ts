/** The gym last picked on a schedule page, kept on this device (localStorage `scheduleGym`). */
export const SCHEDULE_GYM_KEY = 'scheduleGym';

/**
 * The gym a schedule page opens with: the one in the address when it is listed, else the one
 * picked last on this device, else the first.
 */
export function initialGymId(
  gymIds: string[],
  fromAddress: string | null,
): string | null {
  if (fromAddress && gymIds.includes(fromAddress)) {
    return fromAddress;
  }
  const remembered = readRememberedGym();
  if (remembered && gymIds.includes(remembered)) {
    return remembered;
  }
  return gymIds[0] ?? null;
}

export function rememberGym(gymId: string): void {
  try {
    localStorage.setItem(SCHEDULE_GYM_KEY, gymId);
  } catch {
    // Storage can be off (private windows); the choice is just not kept.
  }
}

function readRememberedGym(): string | null {
  try {
    return localStorage.getItem(SCHEDULE_GYM_KEY);
  } catch {
    return null;
  }
}
