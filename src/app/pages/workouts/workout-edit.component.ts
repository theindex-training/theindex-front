import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin, Observable, Subscription } from 'rxjs';
import { ChipComponent } from '../../components/chip/chip.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { Exercise, ExercisesService } from '../../services/exercises.service';
import {
  Workout,
  WorkoutSourcePdf,
  WorkoutsService,
} from '../../services/workouts.service';
import {
  buildWorkoutForm,
  fillFromDraft,
  fillFromWorkout,
  ListedExercise,
  listedFrom,
  listFromWorkout,
  WORKOUT_EXERCISES_MAX,
  WorkoutForm,
  workoutPayload,
} from './workout-form';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Creates a workout of the day (`/workouts/new`, optionally `?date=YYYY-MM-DD`) or edits and
 * deletes one (`/workouts/:id/edit`): its day, name, summary and the exercises it uses. A
 * lesson-plan PDF can fill it; nothing is saved until the form is submitted. Movements the PDF
 * names that the catalogue lacks are created here, or linked to an existing exercise (their
 * spelling becomes one of its other names, so the next PDF finds it). The API keeps the PDF; the
 * workout is saved with it as its source, which can be opened again from this page.
 */
@Component({
  selector: 'app-workout-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    IconComponent,
    ChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './workout-edit.component.html',
  styleUrl: './workout-edit.component.scss',
})
export class WorkoutEditComponent implements OnInit, OnDestroy {
  readonly form: WorkoutForm;
  readonly maxExercises = WORKOUT_EXERCISES_MAX;

  /** Null on the create page. */
  workoutId: string | null = null;
  workout: Workout | null = null;
  /** The catalogue, by name. */
  catalogue: Exercise[] = [];
  /** The workout's exercises, in order. */
  listed: ListedExercise[] = [];
  /** The exercise chosen in "Add an exercise". */
  toAdd = '';
  /** For each movement waiting for an exercise (by index in `listed`): the one chosen to link. */
  linkChoice: Record<number, string> = {};

  loading = true;
  loadFailed = false;
  submitting = false;
  deleting = false;
  /** Set by a submit attempt: every problem is shown from then on. */
  submitted = false;
  errorMessage: UiMessage | null = null;

  importing = false;
  importError: UiMessage | null = null;
  /** What the PDF import could not read (the API's words). */
  importWarnings: string[] = [];
  importedFrom: string | null = null;

  /** The PDF the workout comes from: the saved one, or the last one imported here. */
  sourcePdf: WorkoutSourcePdf | null = null;
  openingPdf = false;
  pdfError: UiMessage | null = null;
  /** The object URL of the PDF last opened, freed when another is opened or the page is left. */
  private pdfUrl: string | null = null;
  /** A PDF being fetched and the tab waiting for it: dropped, tab closed, when the page is left. */
  private pendingPdf: { request: Subscription; tab: Window | null } | null =
    null;

  /** The list entry being created or linked (one at a time). */
  resolving: number | null = null;
  resolveError: UiMessage | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly workoutsService: WorkoutsService,
    private readonly exercisesService: ExercisesService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    const date = this.route.snapshot.queryParamMap.get('date') ?? '';
    this.form = buildWorkoutForm(
      formBuilder,
      DATE_PATTERN.test(date) ? date : '',
    );
  }

  get isNew(): boolean {
    return this.workoutId === null;
  }

  get busy(): boolean {
    return this.submitting || this.deleting || this.importing;
  }

  get hasPending(): boolean {
    return this.listed.some((entry) => entry.kind === 'pending');
  }

  /** Active exercises not in the list yet: what "Add an exercise" offers. */
  get addable(): Exercise[] {
    const listedIds = new Set(
      this.listed.flatMap((e) =>
        e.kind === 'exercise' ? [e.exercise.id] : [],
      ),
    );
    return this.catalogue.filter((e) => e.isActive && !listedIds.has(e.id));
  }

  /** Active exercises, to link a PDF's movement to. */
  get linkable(): Exercise[] {
    return this.catalogue.filter((e) => e.isActive);
  }

  /** The PDF was imported here and isn't saved with the workout yet. */
  get sourcePdfUnsaved(): boolean {
    return (
      !!this.sourcePdf && this.sourcePdf.id !== this.workout?.sourcePdf?.id
    );
  }

  /** "245 KB · 9 Nov 2026": the size and the day it was uploaded. */
  sourcePdfDetails(pdf: WorkoutSourcePdf): string {
    const kb = Math.max(1, Math.round(pdf.sizeBytes / 1024));
    return this.language.t('workouts.import.sourceDetails', {
      size: this.format.number(kb),
      date: this.format.date(pdf.uploadedAt),
    });
  }

  ngOnInit(): void {
    this.workoutId = this.route.snapshot.paramMap.get('id');
    this.load();
  }

  ngOnDestroy(): void {
    // A late answer would make an object URL nothing frees and update a destroyed view.
    this.pendingPdf?.request.unsubscribe();
    this.pendingPdf?.tab?.close();
    this.pendingPdf = null;
    this.releasePdfUrl();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.errorMessage = null;

    forkJoin({
      exercises: this.exercisesService.list(),
      ...(this.workoutId
        ? { workout: this.workoutsService.getById(this.workoutId) }
        : {}),
    }).subscribe({
      next: (loaded) => {
        this.catalogue = loaded.exercises;
        const workout = (loaded as { workout?: Workout }).workout;
        if (workout) {
          this.workout = workout;
          fillFromWorkout(this.form, workout);
          this.listed = listFromWorkout(workout);
          this.sourcePdf = workout.sourcePdf;
        }
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'workouts.form.loadError');
        this.loadFailed = true;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  showError(control: { touched: boolean; invalid: boolean }): boolean {
    return (control.touched || this.submitted) && control.invalid;
  }

  // ---- the exercise list ----

  addExercise(): void {
    const exercise = this.catalogue.find((e) => e.id === this.toAdd);
    if (!exercise || this.listed.length >= WORKOUT_EXERCISES_MAX) {
      return;
    }
    this.listed = [
      ...this.listed,
      { kind: 'exercise', exercise: listedFrom(exercise) },
    ];
    this.toAdd = '';
  }

  removeAt(index: number): void {
    this.listed = this.listed.filter((_, i) => i !== index);
    this.linkChoice = {};
    this.resolveError = null;
  }

  move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.listed.length) {
      return;
    }
    const list = [...this.listed];
    [list[index], list[target]] = [list[target], list[index]];
    this.listed = list;
    this.linkChoice = {};
  }

  setLinkChoice(index: number, event: Event): void {
    this.linkChoice[index] = (event.target as HTMLSelectElement).value;
  }

  /** Adds the PDF's movement to the catalogue as a new exercise and lists it. */
  createPending(index: number): void {
    const entry = this.listed[index];
    if (entry?.kind !== 'pending') {
      return;
    }
    this.resolve(index, this.exercisesService.create({ name: entry.name }));
  }

  /** Lists the chosen exercise instead, adding the PDF's spelling to its other names. */
  linkPending(index: number): void {
    const entry = this.listed[index];
    const exerciseId = this.linkChoice[index];
    if (entry?.kind !== 'pending' || !exerciseId) {
      return;
    }
    this.resolve(index, this.exercisesService.addAlias(exerciseId, entry.name));
  }

  private resolve(index: number, request: Observable<Exercise>): void {
    if (this.resolving !== null) {
      return;
    }
    this.resolving = index;
    this.resolveError = null;
    request.subscribe({
      next: (exercise) => {
        this.catalogue = [
          ...this.catalogue.filter((e) => e.id !== exercise.id),
          exercise,
        ].sort((a, b) => a.name.localeCompare(b.name));
        const already = this.listed.some(
          (e) => e.kind === 'exercise' && e.exercise.id === exercise.id,
        );
        // Linking to an exercise the list already has leaves it there once.
        this.listed = already
          ? this.listed.filter((_, i) => i !== index)
          : this.listed.map((e, i) =>
              i === index
                ? { kind: 'exercise', exercise: listedFrom(exercise) }
                : e,
            );
        this.linkChoice = {};
        this.resolving = null;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.resolveError = apiErrorMessage(
          error,
          'workouts.form.exercises.resolveError',
        );
        this.resolving = null;
        this.changeDetector.detectChanges();
      },
    });
  }

  // ---- PDF import ----

  importPdf(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Let the same file be chosen again after a fix.
    input.value = '';
    if (!file || this.busy) {
      return;
    }

    this.importing = true;
    this.importError = null;
    this.importWarnings = [];
    this.resolveError = null;

    this.workoutsService.importPdf(file).subscribe({
      next: (draft) => {
        this.listed = fillFromDraft(this.form, draft, this.catalogue);
        this.linkChoice = {};
        this.importWarnings = draft.warnings;
        this.importedFrom = file.name;
        // The workout now comes from this PDF (none, when the API couldn't keep it: its
        // warning says so).
        this.sourcePdf = draft.sourcePdf;
        this.pdfError = null;
        this.submitted = false;
        this.importing = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.importError = apiErrorMessage(error, 'workouts.import.error');
        this.importing = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /**
   * Opens the source PDF in a new tab. The file needs the bearer token, so it is fetched and
   * shown from an object URL. The tab is opened right away, in the click, so the browser
   * doesn't block it as a pop-up; it gets its address when the file arrives.
   */
  openSourcePdf(): void {
    const pdf = this.sourcePdf;
    if (!pdf || this.openingPdf) {
      return;
    }
    const tab = window.open('', '_blank');
    if (tab) {
      tab.opener = null;
    }
    this.openingPdf = true;
    this.pdfError = null;
    const request = this.workoutsService.sourcePdf(pdf.id).subscribe({
      next: (blob) => {
        this.pendingPdf = null;
        this.releasePdfUrl();
        const url = URL.createObjectURL(blob);
        this.pdfUrl = url;
        if (tab) {
          tab.location.href = url;
        } else {
          window.open(url, '_blank', 'noopener');
        }
        this.openingPdf = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.pendingPdf = null;
        tab?.close();
        this.pdfError = apiErrorMessage(error, 'workouts.import.openError');
        this.openingPdf = false;
        this.changeDetector.detectChanges();
      },
    });
    if (this.openingPdf) {
      this.pendingPdf = { request, tab };
    }
  }

  private releasePdfUrl(): void {
    if (this.pdfUrl) {
      URL.revokeObjectURL(this.pdfUrl);
      this.pdfUrl = null;
    }
  }

  // ---- save and delete ----

  handleSubmit(): void {
    // While a PDF is being read the form still holds what was there before: saving it would
    // leave the page and drop the import.
    if (this.busy) {
      return;
    }
    this.submitted = true;
    if (this.form.invalid || this.hasPending) {
      this.form.markAllAsTouched();
      this.errorMessage = i18nMessage(
        this.form.invalid ? 'workouts.form.invalid' : 'workouts.form.pending',
      );
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    const payload = workoutPayload(this.form, this.listed, this.sourcePdf);
    const request = this.workoutId
      ? this.workoutsService.update(this.workoutId, payload)
      : this.workoutsService.create(payload);

    request.subscribe({
      next: (workout) => {
        this.submitting = false;
        void this.router.navigate(['/workouts'], {
          queryParams: { week: workout.date },
        });
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'workouts.form.saveError');
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  deleteWorkout(): void {
    if (!this.workout || this.busy) {
      return;
    }
    if (!window.confirm(this.language.t('workouts.form.deleteConfirm'))) {
      return;
    }

    const week = this.workout.date;
    this.deleting = true;
    this.errorMessage = null;
    this.workoutsService.delete(this.workout.id).subscribe({
      next: () => {
        this.deleting = false;
        void this.router.navigate(['/workouts'], { queryParams: { week } });
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'workouts.form.deleteError');
        this.deleting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
