import { ApiMock } from './api-mock';

/** Response fixtures shaped like theindex-api DTOs (see src/app/services/*.service.ts). */

export const inactiveTrainee = {
  traineeId: 't-ivan',
  name: 'Ivan Petrov',
  nickname: 'Vanko',
  lastTrainingDate: '2026-10-20T16:30:00Z',
  activeSubscription: {
    planName: '10 visits',
    type: 'PUNCH',
    startDate: '2026-10-01',
    endDate: null,
    remainingTrainings: 4,
    remainingDays: null,
  },
};

/** The two reports the staff dashboard (/home) loads. */
export function mockStaffHome(
  api: ApiMock,
  inactive: object[] = [inactiveTrainee],
  withoutSubscription: object[] = [],
): void {
  api.on('GET', '/api/attendance/reports/inactive-trainees', {
    body: inactive,
  });
  api.on('GET', '/api/attendance/reports/without-active-subscription', {
    body: withoutSubscription,
  });
}

/** The three lists the trainee dashboard (/my-profile) loads for profile `traineeId`. */
export function mockTraineeHome(api: ApiMock, traineeId = 'trainee-1'): void {
  api.on('GET', `/api/attendance/trainees/${traineeId}`, { body: [] });
  api.on('GET', `/api/trainees/${traineeId}/subscriptions`, { body: [] });
  api.on('GET', '/api/plans', { body: [] });
}

export const trainer = (
  id: string,
  name: string,
  nickname: string | null = null,
  isActive = true,
) => ({
  id,
  name,
  nickname,
  accountId: null,
  isActive,
});

export const gym = (id: string, name: string, isActive = true) => ({
  id,
  name,
  address: null,
  notes: null,
  isActive,
});

export const trainee = (
  id: string,
  name: string,
  nickname: string | null = null,
  overrides: object = {},
) => ({
  id,
  name,
  nickname,
  // Nullable strings in the API's DTO; typed as such so a journey can fill them in.
  phone: null as string | null,
  accountId: null as string | null,
  gymSubscriptionId: null as string | null,
  isActive: true,
  ...overrides,
});

export const plan = (id: string, title: string, overrides: object = {}) => ({
  id,
  type: 'PUNCH',
  title,
  priceCents: 4550,
  credits: 10,
  durationDays: null,
  isActive: true,
  ...overrides,
});

/** An attendance-sessions response (GET /api/attendance/sessions). */
export function sessionsResponse(
  sessions: object[],
  entities: { trainees?: object[]; trainers?: object[] } = {},
) {
  return {
    filters: {
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      trainerId: null,
    },
    sessions,
    entities: {
      trainees: entities.trainees ?? [],
      trainers: entities.trainers ?? [],
      locations: [{ id: 'gym-1', name: 'Center' }],
    },
  };
}

/** One of a trainee's trainings, as GET /api/attendance/trainees/:id returns it. */
export const trainingItem = (
  id: string,
  trainedAt: string,
  overrides: {
    paymentStatus?: 'PAID' | 'UNPAID';
    trainer?: [string, string | null];
    gym?: string;
    traineeId?: string;
  } = {},
) => {
  const [name, nickname] = overrides.trainer ?? ['Petar Petrov', 'Pepi'];
  return {
    id,
    traineeId: overrides.traineeId ?? 'trainee-1',
    trainerId: `trainer-${name}`,
    trainer: { id: `trainer-${name}`, name, nickname },
    locationId: `gym-${overrides.gym ?? 'Center'}`,
    location: {
      id: `gym-${overrides.gym ?? 'Center'}`,
      name: overrides.gym ?? 'Center',
    },
    trainedAt,
    subscriptionId: null,
    gymSubscriptionId: null,
    paymentStatus: overrides.paymentStatus ?? 'PAID',
    createdAt: trainedAt,
  };
};

/** An article category, as GET /api/article-categories returns it. */
export const articleCategory = (
  id: string,
  name: string,
  slug: string,
  overrides: object = {},
) => ({
  id,
  language: 'bg',
  name,
  slug,
  description: null as string | null,
  sortOrder: 0,
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
  ...overrides,
});

/** A row of GET /api/articles (the draft's title). */
export const articleSummary = (
  id: string,
  title: string,
  overrides: object = {},
) => ({
  id,
  status: 'DRAFT',
  slug: null as string | null,
  title,
  publishedTitle: null as string | null,
  categoryIds: [] as string[],
  featuredMediaId: null as string | null,
  hasUnpublishedChanges: true,
  draftUpdatedAt: '2026-11-06T10:00:00.000Z',
  firstPublishedAt: null as string | null,
  lastPublishedAt: null as string | null,
  createdAt: '2026-11-06T09:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
  ...overrides,
});

/** A page of GET /api/articles or GET /api/media. */
export const pageOf = (items: object[], total = items.length, page = 1) => ({
  items,
  total,
  page,
  pageSize: 20,
});

/** GET /api/articles/:id: a never-published draft with an empty body. */
export const article = (id: string, title: string, overrides: object = {}) => ({
  id,
  language: 'bg',
  status: 'DRAFT',
  slug: null as string | null,
  published: null,
  draft: {
    title,
    excerpt: null as string | null,
    content: { blocks: [] as { type: string; data: object }[] },
    featuredMediaId: null as string | null,
    categoryIds: [] as string[],
    seoTitle: null as string | null,
    seoDescription: null as string | null,
    slug: null as string | null,
  },
  draftRevision: 0,
  draftUpdatedAt: '2026-11-06T10:00:00.000Z',
  hasUnpublishedChanges: true,
  firstPublishedAt: null as string | null,
  lastPublishedAt: null as string | null,
  unpublishedAt: null as string | null,
  createdByAccountId: 'acc-admin',
  updatedByAccountId: 'acc-admin',
  createdAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-06T10:00:00.000Z',
  ...overrides,
});

/** An image of the media library. Its files are the app's own logo, so they load. */
export const mediaItem = (id: string, altText: string) => {
  const file = {
    url: '/brand/the-index-logo-red.png',
    width: 640,
    height: 270,
  };
  return {
    id,
    altText,
    ...file,
    variants: [file],
    ogImage: { ...file, width: 1200, height: 630 },
    originalFilename: `${id}.png`,
    sizeBytes: 10_000,
    uploadedByAccountId: 'acc-admin',
    createdAt: '2026-11-06T10:00:00.000Z',
    updatedAt: '2026-11-06T10:00:00.000Z',
  };
};

/** One trainee on the renewals page (theindex-api `GET /subscription-renewals`). */
export const renewalRow = (
  traineeId: string,
  name: string,
  overrides: object = {},
) => ({
  traineeId,
  name,
  nickname: null,
  planTitle: '16 trainings',
  activeSubscriptions: 0,
  remainingCredits: null,
  endsAt: null,
  daysLeft: null,
  daysSinceEnd: null,
  unpaidTrainings: 0,
  lastTrainedAt: null,
  ...overrides,
});
