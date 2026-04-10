import { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FAQS, FAQ_CATEGORIES } from '../data/faqs';
import type { FAQ } from '../data/faqs';
import { processWikiContent, type TocItem } from '../utils/wikiContent';

// ─── SEO / structured data ───────────────────────────────────────────
function FAQJsonLd({ faqs }: { faqs: FAQ[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Longer-form blurbs for each category — shown on the main portal and
// in the left-hand nav tooltip. Kept here rather than in faqs.ts so the
// data file stays focused on content.
const CATEGORY_BLURBS: Record<string, string> = {
  general: 'Release info, platforms, pricing, monetization, developer, and everything else about the game itself.',
  mechanics: 'Battle systems unique to Champions — the Omni Ring, Mega Evolution rules, PP normalization, type effectiveness, and status changes.',
  moves: 'Move base-power changes, new abilities (Piercing Drill, Dragonize, Mega Sol, Spicy Spray), and the Fake Out restrictions that shift the meta.',
  stats: 'The Stat Point system that replaces EVs and IVs — caps, allocation, EV→SP conversion, and how natures still matter.',
  competitive: 'VGC 2026 meta, tier lists, team archetypes, and strategy for ladder and tournament play.',
  transfers: 'Moving Pokémon between GO, HOME, and Champions — what works, what doesn\'t, and the gotchas.',
};

const CATEGORY_ICONS: Record<string, string> = {
  general: 'ℹ',
  mechanics: '⚙',
  moves: '✦',
  stats: '▦',
  competitive: '⚔',
  transfers: '⇄',
};

// ─── Left navigation sidebar ─────────────────────────────────────────
function WikiNav({ activeSlug, activeCategory, onCategoryClick }: {
  activeSlug?: string;
  activeCategory?: string;
  onCategoryClick?: (id: string) => void;
}) {
  return (
    <nav className="text-sm">
      <div className="mb-4">
        <Link
          to="/faq"
          className={`block px-3 py-2 rounded-lg font-semibold transition-colors ${
            !activeSlug && activeCategory === undefined
              ? 'bg-poke-red/15 text-poke-red-light border border-poke-red/30'
              : 'text-slate-300 hover:text-white hover:bg-poke-surface border border-transparent'
          }`}
        >
          Main Page
        </Link>
      </div>

      <div className="mb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        Categories
      </div>
      <div className="space-y-4">
        {FAQ_CATEGORIES.map(cat => {
          const articles = FAQS.filter(f => f.category === cat.id);
          const isActiveCategory = activeCategory === cat.id;
          return (
            <div key={cat.id}>
              <button
                onClick={() => onCategoryClick?.(cat.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                  isActiveCategory
                    ? 'text-poke-red-light'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-sm">{CATEGORY_ICONS[cat.id]}</span>
                <span className="flex-1 text-left">{cat.label}</span>
                <span className="text-[10px] text-slate-600 font-normal">{articles.length}</span>
              </button>
              <ul className="mt-1 ml-2 border-l border-poke-border">
                {articles.map(f => {
                  const isActive = f.slug === activeSlug;
                  return (
                    <li key={f.slug}>
                      <Link
                        to={`/faq/${f.slug}`}
                        className={`block pl-4 pr-2 py-1.5 text-xs leading-snug border-l-2 -ml-px transition-colors ${
                          isActive
                            ? 'border-poke-red text-white bg-poke-red/5 font-medium'
                            : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
                        }`}
                      >
                        {shortenTitle(f.question)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// Trim "Pokémon Champions" noise from navigation titles so the tree
// doesn't feel repetitive.
function shortenTitle(title: string): string {
  return title
    .replace(/ in Pokémon Champions\??$/i, '?')
    .replace(/ Pokémon Champions\??$/i, '?')
    .replace(/Pokémon Champions /gi, '')
    .trim();
}

// ─── Right-side table of contents with scroll-spy ────────────────────
function WikiToc({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (toc.length === 0) return;
    const handler = () => {
      // Pick the last heading whose top is above a fixed offset.
      const offset = 120;
      let current = '';
      for (const item of toc) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top - offset <= 0) current = item.id;
      }
      setActiveId(current || toc[0].id);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [toc]);

  if (toc.length === 0) return null;

  return (
    <div className="sticky top-24">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-3">
        Contents
      </div>
      <ol className="text-xs space-y-0.5">
        {toc.map((item, idx) => (
          <li key={item.id} className={item.level === 3 ? 'ml-3' : ''}>
            <a
              href={`#${item.id}`}
              className={`block px-3 py-1 border-l-2 leading-snug transition-colors ${
                activeId === item.id
                  ? 'border-poke-red text-white font-medium'
                  : 'border-poke-border text-slate-500 hover:text-slate-300 hover:border-slate-500'
              }`}
            >
              <span className="text-slate-600 mr-1">{idx + 1}.</span>
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Single article view ─────────────────────────────────────────────
function WikiArticle({ faq }: { faq: FAQ }) {
  const { html } = useMemo(() => processWikiContent(faq.content), [faq.content]);
  const categoryLabel = FAQ_CATEGORIES.find(c => c.id === faq.category)?.label;

  // Previous / next within the same category for linear reading.
  const siblings = useMemo(() => FAQS.filter(f => f.category === faq.category), [faq.category]);
  const currentIdx = siblings.findIndex(f => f.slug === faq.slug);
  const prev = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const next = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  const related = useMemo(
    () =>
      FAQS.filter(
        f => f.slug !== faq.slug && (f.category === faq.category || f.tags.some(t => faq.tags.includes(t))),
      ).slice(0, 4),
    [faq],
  );

  // Scroll to hash on first mount (direct links to a section)
  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, [faq.slug]);

  return (
    <article className="min-w-0">
      <FAQJsonLd faqs={[faq]} />

      {/* Breadcrumbs */}
      <nav className="text-xs text-slate-500 mb-4 flex items-center gap-1.5 flex-wrap">
        <Link to="/" className="hover:text-poke-red-light transition-colors">Home</Link>
        <span className="text-slate-700">/</span>
        <Link to="/faq" className="hover:text-poke-red-light transition-colors">Wiki</Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-400">{categoryLabel}</span>
      </nav>

      {/* Title block — wiki style: big, serifed, subtle underline */}
      <header className="mb-8 pb-4 border-b border-poke-border">
        <h1 className="wiki-title text-3xl md:text-4xl font-bold text-white leading-tight mb-3">
          {faq.question}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-0.5 bg-poke-red/15 border border-poke-red/30 text-poke-red-light rounded-full font-semibold">
            {categoryLabel}
          </span>
          {faq.tags.slice(0, 6).map(tag => (
            <span key={tag} className="text-slate-500">#{tag}</span>
          ))}
        </div>
      </header>

      {/* Answer blurb — treated as a wiki lead paragraph */}
      <p className="wiki-lead text-lg text-slate-200 leading-relaxed mb-8 italic border-l-4 border-poke-red/50 pl-4">
        {faq.answer}
      </p>

      {/* Article body */}
      <div
        className="wiki-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Prev / Next navigation (within-category) */}
      {(prev || next) && (
        <div className="mt-12 pt-6 border-t border-poke-border grid grid-cols-2 gap-3">
          {prev ? (
            <Link
              to={`/faq/${prev.slug}`}
              className="p-3 rounded-lg border border-poke-border bg-poke-surface hover:border-poke-red/30 transition-colors"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">← Previous</div>
              <div className="text-sm text-white font-medium leading-snug">{shortenTitle(prev.question)}</div>
            </Link>
          ) : <div />}
          {next ? (
            <Link
              to={`/faq/${next.slug}`}
              className="p-3 rounded-lg border border-poke-border bg-poke-surface hover:border-poke-red/30 transition-colors text-right"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Next →</div>
              <div className="text-sm text-white font-medium leading-snug">{shortenTitle(next.question)}</div>
            </Link>
          ) : <div />}
        </div>
      )}

      {/* See also */}
      {related.length > 0 && (
        <section className="mt-12 pt-6 border-t border-poke-border">
          <h2 className="wiki-heading text-xl font-bold text-white mb-4">See also</h2>
          <ul className="space-y-1">
            {related.map(f => (
              <li key={f.slug} className="flex items-baseline gap-2">
                <span className="text-poke-red-light">•</span>
                <Link to={`/faq/${f.slug}`} className="text-sm text-poke-red-light hover:underline">
                  {shortenTitle(f.question)}
                </Link>
                <span className="text-xs text-slate-600">— {FAQ_CATEGORIES.find(c => c.id === f.category)?.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

// ─── Portal / main page (list view) ──────────────────────────────────
function WikiPortal({ searchQuery, activeCategory }: {
  searchQuery: string;
  activeCategory: string;
}) {
  const filtered = useMemo(() => {
    let results = FAQS;
    if (activeCategory !== 'all') {
      results = results.filter(f => f.category === activeCategory);
    }
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      results = results.filter(
        f =>
          f.question.toLowerCase().includes(lower) ||
          f.answer.toLowerCase().includes(lower) ||
          f.tags.some(t => t.includes(lower)),
      );
    }
    return results;
  }, [activeCategory, searchQuery]);

  // Search / filter mode: flat list of matches
  if (searchQuery || activeCategory !== 'all') {
    return (
      <div>
        <div className="mb-6">
          <h1 className="wiki-title text-2xl md:text-3xl font-bold text-white">
            {searchQuery
              ? `Search: "${searchQuery}"`
              : FAQ_CATEGORIES.find(c => c.id === activeCategory)?.label}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {filtered.length} {filtered.length === 1 ? 'article' : 'articles'}
            {activeCategory !== 'all' && !searchQuery && ' in this category'}
          </p>
          {activeCategory !== 'all' && !searchQuery && (
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              {CATEGORY_BLURBS[activeCategory]}
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 rounded-lg border border-poke-border bg-poke-surface text-center">
            <p className="text-slate-500 text-sm">No articles match your query.</p>
          </div>
        ) : (
          <ul className="divide-y divide-poke-border">
            {filtered.map(f => (
              <li key={f.slug}>
                <Link
                  to={`/faq/${f.slug}`}
                  className="block py-4 group"
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-poke-red-light group-hover:text-poke-red transition-colors">→</span>
                    <h3 className="text-base font-bold text-white group-hover:text-poke-red-light transition-colors">
                      {f.question}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-400 ml-5 leading-relaxed line-clamp-2">{f.answer}</p>
                  <div className="flex flex-wrap gap-1 mt-2 ml-5">
                    {f.tags.slice(0, 4).map(t => (
                      <span key={t} className="text-[10px] text-slate-500">#{t}</span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Default "Main Page": wiki portal style with category cards
  return (
    <div>
      <div className="mb-8 pb-6 border-b border-poke-border">
        <h1 className="wiki-title text-3xl md:text-4xl font-bold text-white mb-2">
          Pokémon Champions Wiki
        </h1>
        <p className="text-base text-slate-400 leading-relaxed max-w-2xl">
          A living reference for Pokémon Champions — covering the Stat Point system,
          the Omni Ring, Mega Evolution, competitive play, and the damage calculator.
          Curated from Game8, Bulbapedia, Smogon, and community sources.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <span className="text-slate-500">
            <strong className="text-white">{FAQS.length}</strong> articles
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-500">
            <strong className="text-white">{FAQ_CATEGORIES.length}</strong> categories
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-500">Updated for VGC 2026</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FAQ_CATEGORIES.map(cat => {
          const articles = FAQS.filter(f => f.category === cat.id);
          if (articles.length === 0) return null;
          return (
            <section
              key={cat.id}
              className="p-5 rounded-lg border border-poke-border bg-poke-panel hover:border-poke-red/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl text-poke-red-light">{CATEGORY_ICONS[cat.id]}</span>
                <h2 className="wiki-heading text-lg font-bold text-white">{cat.label}</h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{CATEGORY_BLURBS[cat.id]}</p>
              <ul className="space-y-1.5">
                {articles.map(f => (
                  <li key={f.slug} className="flex items-baseline gap-2">
                    <span className="text-slate-600 text-xs">•</span>
                    <Link
                      to={`/faq/${f.slug}`}
                      className="text-sm text-poke-red-light hover:underline leading-snug"
                    >
                      {shortenTitle(f.question)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────
export function FAQPage() {
  const { slug } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const activeFaq = slug ? FAQS.find(f => f.slug === slug) : null;
  const processedForToc = useMemo(
    () => (activeFaq ? processWikiContent(activeFaq.content) : null),
    [activeFaq],
  );

  return (
    <div className="min-h-screen bg-poke-darkest text-white relative z-10">
      {!activeFaq && <FAQJsonLd faqs={FAQS} />}

      {/* Header */}
      <header className="border-b border-poke-border bg-gradient-to-r from-poke-darker via-poke-dark to-poke-darker backdrop-blur-sm sticky top-0 z-40">
        <div className="h-[3px] bg-gradient-to-r from-transparent via-poke-red to-transparent" />
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-6 h-6 rounded-full border-2 border-white/80 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
              <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/90" />
              <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-poke-border-light -translate-y-1/2" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-poke-border-light bg-poke-dark" />
            </div>
            <h1 className="text-base font-bold tracking-tight hidden sm:block">
              <span className="text-poke-red">Champions</span> Wiki
            </h1>
          </Link>

          {/* Search — always visible in header */}
          <div className="flex-1 max-w-xl">
            <input
              type="text"
              placeholder="Search the wiki..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (e.target.value) setActiveCategory('all');
              }}
              className="w-full bg-poke-surface border border-poke-border rounded-lg px-4 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-poke-red/50 transition-colors"
            />
          </div>

          <Link
            to="/"
            className="text-xs px-3 py-1.5 rounded-lg bg-poke-red/15 border border-poke-red/30 text-poke-red-light hover:bg-poke-red/25 transition-colors shrink-0"
          >
            Calculator
          </Link>
        </div>
      </header>

      {/* Body: left nav | main | right TOC */}
      <div className="max-w-[1400px] mx-auto px-4 py-6 lg:grid lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_200px] lg:gap-8">
        {/* Left navigation */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <WikiNav
              activeSlug={activeFaq?.slug}
              activeCategory={activeFaq ? activeFaq.category : activeCategory === 'all' ? undefined : activeCategory}
              onCategoryClick={id => {
                setActiveCategory(id);
                setSearchQuery('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          {/* Mobile category chips */}
          <div className="lg:hidden mb-4 -mx-4 px-4 overflow-x-auto">
            <div className="flex gap-2 pb-2">
              <button
                onClick={() => { setActiveCategory('all'); setSearchQuery(''); }}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                  activeCategory === 'all' && !searchQuery
                    ? 'bg-poke-red/15 border-poke-red/40 text-poke-red-light'
                    : 'bg-poke-surface border-poke-border text-slate-400'
                }`}
              >
                Main Page
              </button>
              {FAQ_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSearchQuery(''); }}
                  className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-poke-red/15 border-poke-red/40 text-poke-red-light'
                      : 'bg-poke-surface border-poke-border text-slate-400'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {activeFaq ? (
            <WikiArticle faq={activeFaq} />
          ) : (
            <WikiPortal searchQuery={searchQuery} activeCategory={activeCategory} />
          )}
        </main>

        {/* Right TOC (article view only, on xl+) */}
        <aside className="hidden xl:block">
          {activeFaq && processedForToc && <WikiToc toc={processedForToc.toc} />}
        </aside>
      </div>
    </div>
  );
}
