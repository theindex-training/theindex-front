import type { OutputBlockData, OutputData } from '@editorjs/editorjs';
import {
  ArticleBlock,
  ArticleContent,
  ArticleListItem,
} from '../../../../services/articles.service';

/**
 * Between what theindex-api stores (articles/article-content.ts) and what Editor.js loads and
 * saves (theindex-web docs/decision-record.md, section 7). The tool names are the same on both
 * sides. Our image and video tools keep the stored shape (`mediaId`, `videoId`), so only the list
 * needs mapping: @editorjs/list 2.x adds a `meta` to the list and every item, which the API drops.
 */

/** Stored content → the editor's data. */
export function toEditorData(content: ArticleContent | null): OutputData {
  const blocks = (content?.blocks ?? []).map((block): OutputBlockData => {
    const base = block.id ? { id: block.id } : {};
    if (block.type === 'list') {
      return {
        ...base,
        type: 'list',
        data: {
          style: block.data.style,
          meta:
            block.data.style === 'ordered' ? { counterType: 'numeric' } : {},
          items: withMeta(block.data.items),
        },
      };
    }
    return { ...base, type: block.type, data: { ...block.data } };
  });
  const data: OutputData = { blocks };
  if (content?.time !== undefined) data.time = content.time;
  if (content?.version !== undefined) data.version = content.version;
  return data;
}

/**
 * The editor's output → what the autosave sends: each block's id, type and data, without block
 * tunes or the list's `meta`. The API checks and sanitizes it again.
 */
export function fromEditorData(output: OutputData): ArticleContent {
  const blocks = output.blocks.map((block): ArticleBlock => {
    const base = block.id ? { id: block.id } : {};
    if (block.type === 'list') {
      const data = block.data as {
        style: string;
        items: EditorListItem[];
      };
      return {
        ...base,
        type: 'list',
        data: {
          // Checklists are not offered (see editor-tools.ts); were one to appear, it is a plain list.
          style: data.style === 'ordered' ? 'ordered' : 'unordered',
          items: withoutMeta(data.items),
        },
      };
    }
    if (block.type === 'quote') {
      // The quote tool adds an alignment, which the API doesn't keep.
      const { text, caption } = block.data as { text: string; caption: string };
      return { ...base, type: 'quote', data: { text, caption } };
    }
    const data = block.data as unknown;
    return { ...base, type: block.type, data } as ArticleBlock;
  });
  const content: ArticleContent = { blocks };
  if (output.time !== undefined) content.time = output.time;
  if (output.version !== undefined) content.version = output.version;
  return content;
}

/**
 * What the blocks say, without their ids or Editor.js's `time` and `version`: two contents with
 * the same key read the same on the site.
 */
export function blocksKey(content: ArticleContent | null): string {
  return JSON.stringify(
    (content?.blocks ?? []).map((block) => [
      block.type,
      sortedKeys(block.data),
    ]),
  );
}

/** The value with every object's keys in order, so key order never makes two values differ. */
function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          sortedKeys((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
}

interface EditorListItem {
  content: string;
  meta?: object;
  items?: EditorListItem[];
}

function withMeta(items: ArticleListItem[]): EditorListItem[] {
  return items.map((item) => ({
    content: item.content,
    meta: {},
    items: withMeta(item.items),
  }));
}

function withoutMeta(items: EditorListItem[]): ArticleListItem[] {
  return items.map((item) => ({
    content: item.content,
    items: withoutMeta(item.items ?? []),
  }));
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The video id of a YouTube link (watch, youtu.be, embed, shorts, live), or null. The same rules
 * as theindex-api's `youtubeVideoId`, which parses the link again on save.
 */
export function youtubeVideoId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null | undefined;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, value] = url.pathname.split('/');
    id =
      kind === 'watch'
        ? url.searchParams.get('v')
        : ['embed', 'shorts', 'live'].includes(kind)
          ? value
          : undefined;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Pasting a link like this into the editor makes a video block. */
export const YOUTUBE_LINK_PATTERN =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/\S+$/i;
