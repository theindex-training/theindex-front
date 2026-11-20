import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { GymLocationsService } from '../../services/gym-locations.service';
import {
  Settlement,
  SettlementAllocation,
  SettlementLine,
  SettlementWaiting,
  SettlementsService,
} from '../../services/settlements.service';
import {
  TraineeProfile,
  TraineesService,
} from '../../services/trainees.service';
import {
  TrainerProfile,
  TrainersService,
} from '../../services/trainers.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { PaginationComponent } from '../../components/pagination/pagination.component';
import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  pageOffset,
  pageRange,
  pageSlice,
  parsePage,
  parsePageSize,
} from '../../components/pagination/pagination';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { LanguageService } from '../../i18n/language.service';

type SettlementTab = 'paid' | 'waiting';

@Component({
  selector: 'app-settlement-details',
  standalone: true,
  imports: [
    EnumLabelPipe,
    UiMessagePipe,
    TranslocoPipe,
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    SkeletonListComponent,
    ChipComponent,
    AvatarComponent,
    SegmentedControlComponent,
    PaginationComponent,
  ],
  templateUrl: './settlement-details.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './settlement-details.component.scss',
})
/**
 * One settlement report: what it pays each trainer (a draft is worked out by the API whenever it is
 * read), then two tabs: the trainings it pays and its period's trainings that wait for a later
 * report. An admin finalizes a draft here, after confirming the payout.
 *
 * Both tabs are paged (`app-pagination`): the paid trainings by the API (`offset`/`limit`), the
 * waiting ones in the browser (the report gives them all). The tab, page, page size and the
 * admin's trainer filter are kept in the address (`?tab=waiting&page=3&size=100&trainer=…`, the
 * defaults left out, replacing the entry), so going back from a trainee returns to the same rows.
 */
export class SettlementDetailsComponent implements OnInit {
  readonly format = inject(LocaleFormatService);
  private readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  settlement: Settlement | null = null;
  lines: SettlementLine[] = [];
  waiting: SettlementWaiting[] = [];
  allocations: SettlementAllocation[] = [];
  allocationsTotal = 0;

  trainers: TrainerProfile[] = [];
  trainerLabelById = new Map<string, string>();
  traineeLabelById = new Map<string, string>();
  locationNameById = new Map<string, string>();

  /** From `?trainer=` (admins only; the API gives a trainer their own rows). */
  selectedTrainerId = '';
  tab: SettlementTab = 'paid';
  /** The page of the open tab, from `?page=`. */
  page = 1;
  pageSize = DEFAULT_PAGE_SIZE;
  /** The page of paid trainings asked for (page 1 while the Waiting tab is open). */
  allocationsPage = 1;

  loading = true;
  /** Until the first answer: the skeleton. Later pages keep the rows until theirs come. */
  loadingAllocations = true;
  /** A page, page size or filter change on its way; the shown rows are about to be replaced. */
  updatingAllocations = false;
  loadingEntities = true;
  finalizing = false;
  isAdmin = false;
  errorMessage: UiMessage | null = null;
  allocationError: UiMessage | null = null;

  /** The start of the tabs, brought into view after a page change. */
  @ViewChild('listTop') private listTop?: ElementRef<HTMLElement>;

  private settlementId = '';
  /** The query of the allocations shown (or on their way), so a repeated one isn't sent again. */
  private allocationsKey = '';
  private allocationsRequest?: Subscription;
  private scrollPending = false;
  private paramsApplied = false;
  private tabOptionsKey = '';
  private tabOptionsCache: SegmentedOption<SettlementTab>[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly settlementsService: SettlementsService,
    private readonly trainersService: TrainersService,
    private readonly traineesService: TraineesService,
    private readonly gymLocationsService: GymLocationsService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('settlements.errors.missingId');
      this.loading = false;
      return;
    }

    this.settlementId = id;
    this.isAdmin = this.authService.getUserRole() === 'ADMIN';
    this.loadEntities();
    this.loadSettlement();
    // The page is reused when only the query changes (tab, page, size, trainer).
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyParams(params));
  }

  /** The tab, page, page size and trainer from the address; loads the paid rows they need. */
  private applyParams(params: ParamMap): void {
    const trainerId = this.isAdmin ? (params.get('trainer') ?? '') : '';
    const pageSize = parsePageSize(params.get('size'));
    const sameList =
      trainerId === this.selectedTrainerId && pageSize === this.pageSize;

    this.tab = params.get('tab') === 'waiting' ? 'waiting' : 'paid';
    this.page = parsePage(params.get('page'));
    this.pageSize = pageSize;
    this.selectedTrainerId = trainerId;
    // The Waiting tab keeps the paid page it had (for the tab's count), unless the list changed.
    if (this.tab === 'paid') {
      this.allocationsPage = this.page;
    } else if (!sameList) {
      this.allocationsPage = 1;
    }

    this.loadAllocations();
    // The first call comes from ngOnInit, which the first check follows anyway.
    if (this.paramsApplied) {
      this.changeDetector.detectChanges();
    }
    this.paramsApplied = true;
    if (this.tab === 'waiting') {
      this.scrollToList();
    }
  }

  /** Loads the report; `quietly` keeps what is shown until the answer comes (after finalizing). */
  loadSettlement(quietly = false): void {
    this.loading = !quietly;
    if (!quietly) {
      this.errorMessage = null;
    }

    this.settlementsService.getById(this.settlementId).subscribe({
      next: (response) => {
        this.settlement = response.settlement;
        this.lines = response.lines;
        this.waiting = response.waiting;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'settlements.details.loadError',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** Loads the page of paid trainings asked for; `force` asks again for the same one. */
  loadAllocations(force = false): void {
    const query = {
      trainerId: this.selectedTrainerId || undefined,
      offset: pageOffset(this.allocationsPage, this.pageSize),
      limit: this.pageSize,
    };
    const key = JSON.stringify(query);
    if (!force && key === this.allocationsKey) {
      return;
    }

    this.allocationsKey = key;
    this.allocationsRequest?.unsubscribe();
    this.allocationError = null;
    this.updatingAllocations = !this.loadingAllocations;

    this.allocationsRequest = this.settlementsService
      .allocations(this.settlementId, query)
      .subscribe({
        next: (response) => {
          // A page past the end (an old link, or fewer rows since): show the last one instead.
          const last = clampPage(
            this.allocationsPage,
            response.total,
            this.pageSize,
          );
          if (!response.rows.length && last < this.allocationsPage) {
            if (this.tab === 'paid') {
              this.goTo({ page: last });
            } else {
              this.allocationsPage = last;
              this.loadAllocations();
            }
            return;
          }
          this.allocations = response.rows;
          this.allocationsTotal = response.total;
          this.loadingAllocations = false;
          this.updatingAllocations = false;
          this.changeDetector.detectChanges();
          this.scrollToList();
        },
        error: (error) => {
          this.allocationError = apiErrorMessage(
            error,
            'settlements.details.loadAllocationsError',
          );
          // Asking again for the same page is a retry.
          this.allocationsKey = '';
          this.loadingAllocations = false;
          this.updatingAllocations = false;
          this.changeDetector.detectChanges();
        },
      });
  }

  selectTab(tab: SettlementTab): void {
    this.goTo({ tab, page: 1 });
  }

  changePage(page: number): void {
    this.scrollPending = true;
    this.goTo({ page });
  }

  changePageSize(pageSize: number): void {
    this.goTo({ size: pageSize, page: 1 });
  }

  changeTrainer(trainerId: string): void {
    this.goTo({ trainer: trainerId, page: 1 });
  }

  /** The Paid / Waiting options, with how many rows each has (cached: the control needs the same array). */
  get tabOptions(): SegmentedOption<SettlementTab>[] {
    const paid = this.loadingAllocations ? null : this.allocationsTotal;
    const waiting = this.settlement ? this.shownWaiting.length : null;
    const key = `${this.i18n.lang()}|${paid}|${waiting}`;
    if (key !== this.tabOptionsKey) {
      this.tabOptionsKey = key;
      this.tabOptionsCache = [
        {
          value: 'paid',
          label: this.tabLabel('settlements.details.tabPaid', paid),
        },
        {
          value: 'waiting',
          label: this.tabLabel('settlements.details.tabWaiting', waiting),
        },
      ];
    }
    return this.tabOptionsCache;
  }

  /** "51–100 of 4,812 rows" for the open tab, or null while there is nothing to count. */
  get shownRange(): string | null {
    const total =
      this.tab === 'paid'
        ? this.loadingAllocations || this.allocationError
          ? 0
          : this.allocationsTotal
        : this.shownWaiting.length;
    if (!total) {
      return null;
    }
    const page = this.tab === 'paid' ? this.allocationsPage : this.page;
    const { from, to } = pageRange(page, this.pageSize, total);
    return this.i18n.t('settlements.details.showingRange', {
      from: this.format.number(from),
      to: this.format.number(to),
      total,
      totalText: this.format.number(total),
    });
  }

  /** The page of the Waiting tab, kept within its pages. */
  get waitingPage(): number {
    return clampPage(this.page, this.shownWaiting.length, this.pageSize);
  }

  /** The waiting trainings of the page shown. */
  get waitingRows(): SettlementWaiting[] {
    return pageSlice(this.shownWaiting, this.page, this.pageSize);
  }

  /** The waiting trainings, limited to the trainer picked in the filter (admins). */
  get shownWaiting(): SettlementWaiting[] {
    return this.selectedTrainerId
      ? this.waiting.filter((row) => row.trainerId === this.selectedTrainerId)
      : this.waiting;
  }

  /** Why a training waits, as shown in its row. */
  waitingReason(row: SettlementWaiting): string {
    switch (row.reason) {
      case 'UNPAID':
        return this.i18n.t('settlements.details.waitingUnpaid');
      case 'TIME_PASS_NOT_ENDED':
        return row.availableFrom
          ? this.i18n.t('settlements.details.waitingTimePass', {
              date: this.format.date(row.availableFrom),
            })
          : this.i18n.t('settlements.details.waitingNextReport');
      default:
        return this.i18n.t('settlements.details.waitingNextReport');
    }
  }

  finalizeSettlement(): void {
    const settlement = this.settlement;
    if (
      !this.isAdmin ||
      !settlement ||
      settlement.status !== 'DRAFT' ||
      this.finalizing
    ) {
      return;
    }

    const total = this.lines.reduce((sum, line) => sum + line.amountCents, 0);
    const confirmed = window.confirm(
      this.i18n.t('settlements.details.confirmFinalize', {
        start: this.format.date(settlement.periodStart),
        end: this.format.date(settlement.periodEnd),
        total: this.formatCurrency(total),
      }),
    );
    if (!confirmed) {
      return;
    }

    this.finalizing = true;
    this.errorMessage = null;

    this.settlementsService.finalize(settlement.id).subscribe({
      next: (finalized) => {
        this.settlement = finalized;
        this.finalizing = false;
        // What was paid is now stored: show it as the API keeps it.
        this.loadSettlement(true);
        this.loadAllocations(true);
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'settlements.details.finalizeError',
        );
        this.finalizing = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  formatTrainer(trainerId: string): string {
    return this.trainerLabelById.get(trainerId) || trainerId;
  }

  /** The trainer's profile photo thumbnail (from the trainers list), or null. */
  trainerPhoto(trainerId: string): string | null {
    return this.trainers.find((t) => t.id === trainerId)?.photoUrl ?? null;
  }

  formatTrainee(traineeId: string | undefined): string {
    if (!traineeId) {
      return '—';
    }

    return this.traineeLabelById.get(traineeId) || traineeId;
  }

  formatGym(locationId: string | null | undefined): string {
    if (!locationId) {
      return '—';
    }

    return this.locationNameById.get(locationId) || locationId;
  }

  formatCurrency(valueCents: number): string {
    return this.format.money(valueCents);
  }

  formatDate(date: string): string {
    return this.format.dateTime(date);
  }

  formatOptionalDate(date: string | undefined): string {
    return date ? this.formatDate(date) : '—';
  }

  private tabLabel(key: string, count: number | null): string {
    const label = this.i18n.t(key);
    return count === null
      ? label
      : this.i18n.t('settlements.details.tabCount', {
          label,
          count: this.format.number(count),
        });
  }

  /** Puts the new settings in the address (replacing the entry); `applyParams` takes them from there. */
  private goTo(changes: {
    tab?: SettlementTab;
    page?: number;
    size?: number;
    trainer?: string;
  }): void {
    const next = {
      tab: this.tab,
      page: this.page,
      size: this.pageSize,
      trainer: this.selectedTrainerId,
      ...changes,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        tab: next.tab === 'paid' ? null : next.tab,
        page: next.page > 1 ? next.page : null,
        size: next.size === DEFAULT_PAGE_SIZE ? null : next.size,
        trainer: next.trainer || null,
      },
    });
  }

  /** After a page change, brings the top of the list into view when it is scrolled past. */
  private scrollToList(): void {
    if (!this.scrollPending) {
      return;
    }
    this.scrollPending = false;
    const top = this.listTop?.nativeElement;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView?.({ block: 'start' });
    }
  }

  private formatTraineeLabel(trainee: TraineeProfile): string {
    const nickname = trainee.nickname?.trim();

    return nickname ? `${trainee.name} (${nickname})` : trainee.name;
  }

  private loadEntities(): void {
    this.loadingEntities = true;

    this.trainersService.list().subscribe({
      next: (trainers) => {
        this.trainers = trainers;
        this.trainerLabelById = new Map(
          trainers.map((trainer) => [
            trainer.id,
            trainer.nickname?.trim() || trainer.name,
          ]),
        );
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.changeDetector.detectChanges();
      },
    });

    this.traineesService.list().subscribe({
      next: (trainees: TraineeProfile[]) => {
        this.traineeLabelById = new Map(
          trainees.map((trainee) => [
            trainee.id,
            this.formatTraineeLabel(trainee),
          ]),
        );
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.changeDetector.detectChanges();
      },
    });

    this.gymLocationsService.list(true).subscribe({
      next: (locations) => {
        this.locationNameById = new Map(
          locations.map((location) => [location.id, location.name]),
        );
        this.loadingEntities = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.loadingEntities = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
