import { ArticleContent } from '../../../../services/articles.service';
import {
  YOUTUBE_LINK_PATTERN,
  fromEditorData,
  toEditorData,
  youtubeVideoId,
} from './article-content';

/** Content as theindex-api stores and returns it. */
const STORED: ArticleContent = {
  time: 1762430000000,
  version: '2.31.7',
  blocks: [
    { id: 'p1', type: 'paragraph', data: { text: 'Здравейте, <b>атлети</b>' } },
    { id: 'h1', type: 'header', data: { text: 'Загрявка', level: 2 } },
    {
      id: 'l1',
      type: 'list',
      data: {
        style: 'ordered',
        items: [
          {
            content: 'Клек',
            items: [{ content: 'Гоблет', items: [] }],
          },
          { content: 'Набиране', items: [] },
        ],
      },
    },
    {
      id: 'q1',
      type: 'quote',
      data: { text: 'Без болка', caption: 'Треньор' },
    },
    { id: 'i1', type: 'image', data: { mediaId: 'm-1', caption: 'Щанга' } },
    {
      id: 'v1',
      type: 'embed',
      data: { service: 'youtube', videoId: 'dQw4w9WgXcQ', caption: '' },
    },
    { id: 'd1', type: 'delimiter', data: {} },
  ],
};

describe('article content mapping', () => {
  it('gives the list tool its meta on the list and every item, nested ones included', () => {
    const list = toEditorData(STORED).blocks[2];

    expect(list).toEqual({
      id: 'l1',
      type: 'list',
      data: {
        style: 'ordered',
        meta: { counterType: 'numeric' },
        items: [
          {
            content: 'Клек',
            meta: {},
            items: [{ content: 'Гоблет', meta: {}, items: [] }],
          },
          { content: 'Набиране', meta: {}, items: [] },
        ],
      },
    });
  });

  it('passes the other blocks, the time and the version through as stored', () => {
    const data = toEditorData(STORED);

    expect(data.time).toBe(STORED.time);
    expect(data.version).toBe('2.31.7');
    expect(data.blocks.filter((block) => block.type !== 'list')).toEqual(
      STORED.blocks.filter((block) => block.type !== 'list'),
    );
  });

  it('starts empty without content', () => {
    expect(toEditorData(null)).toEqual({ blocks: [] });
  });

  it('saves back exactly what the API stored (the round trip is lossless)', () => {
    expect(fromEditorData(toEditorData(STORED))).toEqual(STORED);
  });

  it('drops the list meta, block tunes and the start number before sending', () => {
    const content = fromEditorData({
      blocks: [
        {
          id: 'l1',
          type: 'list',
          data: {
            style: 'ordered',
            meta: { start: 3, counterType: 'upper-roman' },
            items: [{ content: 'Едно', meta: {}, items: [] }],
          },
          tunes: { alignment: { alignment: 'center' } },
        },
      ],
    });

    expect(content).toEqual({
      blocks: [
        {
          id: 'l1',
          type: 'list',
          data: { style: 'ordered', items: [{ content: 'Едно', items: [] }] },
        },
      ],
    });
  });

  it('sends a checklist as a plain list, which the API accepts', () => {
    const content = fromEditorData({
      blocks: [
        {
          type: 'list',
          data: {
            style: 'checklist',
            meta: {},
            items: [{ content: 'Вода', meta: { checked: true } }],
          },
        },
      ],
    });

    expect(content.blocks[0]).toEqual({
      type: 'list',
      data: { style: 'unordered', items: [{ content: 'Вода', items: [] }] },
    });
  });
});

describe('youtubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['  http://youtu.be/dQw4w9WgXcQ  ', 'dQw4w9WgXcQ'],
  ])('reads the id of %s', (link, id) => {
    expect(youtubeVideoId(link)).toBe(id);
  });

  it.each([
    'https://vimeo.com/123456',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/channel/UC123',
    'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    'ftp://youtu.be/dQw4w9WgXcQ',
    'not a link',
  ])('refuses %s', (link) => {
    expect(youtubeVideoId(link)).toBeNull();
  });

  it('turns pasted YouTube links into video blocks, and nothing else', () => {
    expect(YOUTUBE_LINK_PATTERN.test('https://youtu.be/dQw4w9WgXcQ')).toBe(
      true,
    );
    expect(
      YOUTUBE_LINK_PATTERN.test('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe(true);
    expect(YOUTUBE_LINK_PATTERN.test('https://example.com/youtube.com/x')).toBe(
      false,
    );
  });
});
