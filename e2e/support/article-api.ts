import { ApiMock } from './api-mock';
import { article } from './data';

type Article = ReturnType<typeof article>;
type Draft = Article['draft'];

/**
 * One article behind the mocked API, answering the editor the way theindex-api does: autosave
 * merges the sent fields and counts the revision up (409 when stale), publish checks the same
 * rules (400 with a list) and copies the draft over, and unpublish, discard, delete and preview
 * tokens follow the lifecycle in the decision record (section 5).
 */
export function articleApi(api: ApiMock, start: Article) {
  let current: Article = start;
  let deleted = false;
  let tokens = 0;
  const path = `/api/articles/${start.id}`;
  const stale = {
    status: 409,
    body: { statusCode: 409, message: 'Stale', currentRevision: 0 },
  };
  const conflict = (message: string) => ({
    status: 409,
    body: { statusCode: 409, message },
  });

  api.on('GET', path, () =>
    deleted
      ? { status: 404, body: { statusCode: 404, message: 'Article not found' } }
      : { body: current },
  );

  api.on('PATCH', `${path}/draft`, (request) => {
    const { baseRevision, ...changes } = request.body as Partial<Draft> & {
      baseRevision: number;
    };
    if (baseRevision !== current.draftRevision) return stale;
    current = {
      ...current,
      draft: { ...current.draft, ...changes },
      draftRevision: current.draftRevision + 1,
      hasUnpublishedChanges: true,
    };
    return { body: current };
  });

  api.on('POST', `${path}/publish`, (request) => {
    const { baseRevision } = request.body as { baseRevision: number };
    if (baseRevision !== current.draftRevision) return stale;
    const problems: string[] = [];
    if (!current.draft.title.trim()) problems.push('The article needs a title');
    if (!current.draft.content.blocks.length) {
      problems.push('The article needs some content');
    }
    if (problems.length) {
      return { status: 400, body: { statusCode: 400, message: problems } };
    }
    const now = '2026-11-07T10:00:00.000Z';
    const { slug: chosen, categoryIds, ...version } = current.draft;
    current = {
      ...current,
      status: 'PUBLISHED',
      slug: current.slug ?? chosen ?? 'kak-da-zapochnem',
      published: { ...version, categoryIds } as never,
      hasUnpublishedChanges: false,
      firstPublishedAt: current.firstPublishedAt ?? now,
      lastPublishedAt: now,
      unpublishedAt: null,
    };
    return { body: current };
  });

  api.on('POST', `${path}/unpublish`, () => {
    if (current.status !== 'PUBLISHED') {
      return conflict('Only a published article can be unpublished');
    }
    current = {
      ...current,
      status: 'UNPUBLISHED',
      unpublishedAt: '2026-11-07T11:00:00.000Z',
    };
    return { body: current };
  });

  api.on('POST', `${path}/discard-draft`, (request) => {
    const { baseRevision } = request.body as { baseRevision: number };
    if (baseRevision !== current.draftRevision) return stale;
    const published = current.published as unknown as Draft | null;
    if (!published) {
      return conflict('The article has never been published');
    }
    current = {
      ...current,
      draft: { ...published, slug: current.slug },
      draftRevision: current.draftRevision + 1,
      hasUnpublishedChanges: false,
    };
    return { body: current };
  });

  api.on('DELETE', path, () => {
    if (current.status === 'PUBLISHED') {
      return conflict('Unpublish the article before deleting it permanently');
    }
    deleted = true;
    return { body: { deleted: true } };
  });

  api.on('POST', `${path}/preview-token`, () => {
    tokens += 1;
    return {
      status: 201,
      body: { token: `tok-${tokens}`, expiresAt: '2026-11-07T10:30:00.000Z' },
    };
  });

  return () => current;
}
