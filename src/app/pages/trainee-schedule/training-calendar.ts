import { Router } from '@angular/router';
import { LanguageService } from '../../i18n/language.service';
import { TrainingDetails } from '../../services/bookings.service';
import { googleCalendarUrl } from './google-calendar';

/**
 * Google Calendar with a trainee's training filled in: "CrossFit training", its start and end, the
 * gym's address (else its name) as the place, and as the description the trainer, the workout's
 * name once it is out and a link to the training's page. In the language the page is shown in.
 */
export function trainingCalendarUrl(
  training: TrainingDetails,
  language: LanguageService,
  router: Router,
): string {
  const page = new URL(
    router.serializeUrl(router.createUrlTree(['/schedule', training.id])),
    document.baseURI,
  ).href;
  const details = [
    language.t('googleCalendar.event.trainer', { name: training.trainer.name }),
    training.workout?.title
      ? language.t('googleCalendar.event.workout', {
          title: training.workout.title,
        })
      : null,
    page,
  ].filter((line): line is string => !!line);
  return googleCalendarUrl({
    title: language.t('googleCalendar.event.title'),
    startsAt: training.startsAt,
    endsAt: training.endsAt,
    location: training.gym.address?.trim() || training.gym.name,
    details: details.join('\n'),
  });
}
