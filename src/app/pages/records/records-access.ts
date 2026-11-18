import { AuthService } from '../../services/auth.service';

/**
 * Whether the signed-in person has results of their own (theindex-api `benchmark-owner.ts`):
 * a trainee with a trainee profile, a trainer with a trainer profile, an admin only when its
 * account is linked to one. The API decides; this only shapes the page.
 */
export function canLogResults(auth: AuthService): boolean {
  const role = auth.getUserRole();
  const trainee = auth.getTraineeProfileId();
  const trainer = auth.getTrainerProfileId();
  if (role === 'TRAINEE') {
    return !!trainee;
  }
  if (role === 'TRAINER') {
    return !!trainer;
  }
  return !!(trainee || trainer);
}
