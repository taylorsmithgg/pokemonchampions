import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FAQS, FAQ_CATEGORIES } from '../data/faqs';
import type { FAQ } from '../data/faqs';

function FAQJsonLd({ faqs }: { faqs: FAQ[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function FAQDetail({ faq }: { faq: FAQ }) {
  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/faq"
        className="inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to all FAQs
      </Link>

      {/* Single FAQ structured data */}
      <FAQJsonLd faqs={[faq]} />

      <article className="faq-content">
        <div className="mb-4">
          <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">
            {FAQ_CATEGORIES.find(c => c.id === faq.category)?.label}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-6 leading-tight">{faq.question}</h1>
        <div
          className="prose prose-invert max-w-none
            [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-4
            [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-200 [&_h3]:mt-6 [&_h3]:mb-3
            [&_p]:text-slate-300 [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:space-y-2 [&_ul]:mb-4
            [&_ol]:space-y-2 [&_ol]:mb-4
            [&_li]:text-slate-300 [&_li]:leading-relaxed
            [&_strong]:text-white
            [&_em]:text-slate-400
            [&_table]:w-full [&_table]:mb-4 [&_table]:border-collapse
            [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-400 [&_th]:uppercase [&_th]:tracking-wider [&_th]:py-2 [&_th]:px-3 [&_th]:border-b [&_th]:border-slate-700 [&_th]:bg-slate-800/50
            [&_td]:py-2 [&_td]:px-3 [&_td]:text-sm [&_td]:text-slate-300 [&_td]:border-b [&_td]:border-slate-800
            [&_.flow-diagram]:flex [&_.flow-diagram]:items-center [&_.flow-diagram]:gap-3 [&_.flow-diagram]:justify-center [&_.flow-diagram]:py-4 [&_.flow-diagram]:my-4 [&_.flow-diagram]:bg-slate-800/50 [&_.flow-diagram]:rounded-lg
            [&_.flow-diagram_span]:text-white [&_.flow-diagram_span]:font-semibold
            [&_.flow-diagram_.arrow]:text-indigo-400 [&_.flow-diagram_.arrow]:text-xl
          "
          dangerouslySetInnerHTML={{ __html: faq.content }}
        />
      </article>

      {/* Related FAQs */}
      <div className="mt-12 pt-8 border-t border-slate-800">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Related Questions</h3>
        <div className="space-y-2">
          {FAQS.filter(f => f.slug !== faq.slug && (f.category === faq.category || f.tags.some(t => faq.tags.includes(t))))
            .slice(0, 4)
            .map(f => (
              <Link
                key={f.slug}
                to={`/faq/${f.slug}`}
                className="block p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/30 transition-colors"
              >
                <p className="text-sm text-white font-medium">{f.question}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{f.answer}</p>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

export function FAQPage() {
  const { slug } = useParams();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // If we have a slug, show the detail page
  const activeFaq = slug ? FAQS.find(f => f.slug === slug) : null;
  if (activeFaq) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-indigo-400">Champions</span> Calc
              </h1>
            </Link>
            <Link
              to="/faq"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600 transition-colors"
            >
              All FAQs
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6">
          <FAQDetail faq={activeFaq} />
        </main>
      </div>
    );
  }

  const filtered = useMemo(() => {
    let results = FAQS;
    if (activeCategory !== 'all') {
      results = results.filter(f => f.category === activeCategory);
    }
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      results = results.filter(f =>
        f.question.toLowerCase().includes(lower) ||
        f.answer.toLowerCase().includes(lower) ||
        f.tags.some(t => t.includes(lower))
      );
    }
    return results;
  }, [activeCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <FAQJsonLd faqs={FAQS} />

      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-indigo-400">Champions</span> Calc
            </h1>
          </Link>
          <Link
            to="/"
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
          >
            Damage Calculator
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Pokémon Champions FAQ</h1>
          <p className="text-slate-400">Everything you need to know about Pokémon Champions, competitive play, and the damage calculator.</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory('all')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeCategory === 'all'
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            All ({FAQS.length})
          </button>
          {FAQ_CATEGORIES.map(cat => {
            const count = FAQS.filter(f => f.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {/* FAQ list */}
        <div className="space-y-3">
          {filtered.map(faq => (
            <Link
              key={faq.slug}
              to={`/faq/${faq.slug}`}
              className="block p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">
                    {faq.question}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{faq.answer}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {faq.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No matching questions found.</p>
          </div>
        )}
      </main>

      {/* Footer with SEO links */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {FAQ_CATEGORIES.map(cat => (
              <div key={cat.id}>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{cat.label}</h4>
                <div className="space-y-1">
                  {FAQS.filter(f => f.category === cat.id).map(f => (
                    <Link
                      key={f.slug}
                      to={`/faq/${f.slug}`}
                      className="block text-xs text-slate-600 hover:text-indigo-400 truncate transition-colors"
                    >
                      {f.question.replace('Pokémon Champions', '').replace('Pokémon', '').trim()}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-700">Pokémon Champions Damage Calculator & FAQ</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
