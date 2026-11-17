import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';

/**
 * Why a trainee's training shows no workout: not out yet, with when it comes out (20:00 the day
 * before, `workoutReleasesAt` from the API), or not chosen by the staff.
 */
export function noWorkoutMessage(
  workoutReleasesAt: string,
  language: LanguageService,
  format: LocaleFormatService,
): string {
  const releasesAt = new Date(workoutReleasesAt);
  if (releasesAt.getTime() > Date.now()) {
    return language.t('traineeTraining.workoutComesOut', {
      day: format.custom(releasesAt, 'EEEE, d MMMM'),
      time: format.clock(releasesAt),
    });
  }
  return language.t('traineeTraining.noWorkoutMessage');
}
