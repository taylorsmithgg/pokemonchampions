// Wiki-style content processing:
//   - Extract a table-of-contents from h2/h3 headings
//   - Inject stable slug IDs on each heading so the TOC can link to them
//
// The FAQ content field is hand-authored HTML, so we transform it once
// per render via a plain string pass (no DOMParser — keeps this safe
// to run in any environment and cheap enough to memoize per article).

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface ProcessedWikiContent {
  html: string;
  toc: TocItem[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function processWikiContent(rawHtml: string): ProcessedWikiContent {
  const toc: TocItem[] = [];
  const usedIds = new Set<string>();

  const html = rawHtml.replace(/<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi, (_match, tag, attrs, inner) => {
    // Strip any inner HTML for the TOC text (e.g., <strong>)
    const plainText = inner.replace(/<[^>]+>/g, '').trim();
    if (!plainText) return _match;

    let id = slugify(plainText);
    let counter = 2;
    while (usedIds.has(id)) {
      id = `${slugify(plainText)}-${counter++}`;
    }
    usedIds.add(id);

    toc.push({
      id,
      text: plainText,
      level: tag.toLowerCase() === 'h2' ? 2 : 3,
    });

    // Preserve any existing attributes on the tag; add our id if not present
    if (/\sid=/.test(attrs)) return `<${tag}${attrs}>${inner}</${tag}>`;
    return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;
  });

  return { html, toc };
}
