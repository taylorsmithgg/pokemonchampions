#!/usr/bin/env node
// Scrape pikalytics Pokemon Champions tournament top-teams page.
// Output normalized JSON committed to src/data/pikalyticsTopTeams.json.
// Run locally: `npm run scrape:pikalytics`. CI runs on schedule.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = 'https://www.pikalytics.com/topteams/championstournaments';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'pikalyticsTopTeams.json');

const res = await fetch(URL, {
  headers: { 'User-Agent': 'pokemonchampions-meta-scraper (+https://github.com/taylorsmithgg/pokemonchampions)' },
});
if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
const html = await res.text();

const match = html.match(/window\.__TOPTEAMS_DATA__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
if (!match) {
  console.error('Embedded __TOPTEAMS_DATA__ not found. Page structure changed.');
  process.exit(1);
}

const raw = JSON.parse(match[1]);
if (!Array.isArray(raw.teams) || raw.teams.length === 0) {
  console.error('No teams parsed.');
  process.exit(1);
}

const teams = raw.teams.map((t) => ({
  ranking: t.ranking,
  author: t.author,
  record: t.record,
  wins: t.recordData?.wins ?? 0,
  losses: t.recordData?.losses ?? 0,
  ties: t.recordData?.ties ?? 0,
  archetypes: Array.isArray(t.archetypes) ? t.archetypes : [],
  tournamentLabel: t.tournamentLabel,
  tournamentId: t.tournamentId,
  link: t.link,
  pokemon: t.pokemon.map((p) => ({ name: p.name, item: p.item || '' })),
}));

const pokemonUsage = {};
const itemByPokemon = {};
const teammates = {};
const archetypes = {};

for (const t of teams) {
  for (const a of t.archetypes) archetypes[a] = (archetypes[a] || 0) + 1;
  const names = t.pokemon.map((p) => p.name);
  for (const p of t.pokemon) {
    pokemonUsage[p.name] = (pokemonUsage[p.name] || 0) + 1;
    if (p.item) {
      itemByPokemon[p.name] ||= {};
      itemByPokemon[p.name][p.item] = (itemByPokemon[p.name][p.item] || 0) + 1;
    }
  }
  for (const a of names) {
    teammates[a] ||= {};
    for (const b of names) {
      if (a === b) continue;
      teammates[a][b] = (teammates[a][b] || 0) + 1;
    }
  }
}

const total = teams.length;
const usagePercent = Object.fromEntries(
  Object.entries(pokemonUsage)
    .map(([name, n]) => [name, +(n / total * 100).toFixed(2)])
    .sort((a, b) => b[1] - a[1])
);

const output = {
  source: URL,
  format: raw.format,
  formatLabel: raw.formatLabel,
  scrapedAt: new Date().toISOString(),
  totalTeams: total,
  archetypeUsage: Object.fromEntries(
    Object.entries(archetypes).sort((a, b) => b[1] - a[1])
  ),
  pokemonUsagePercent: usagePercent,
  pokemonUsageCount: Object.fromEntries(
    Object.entries(pokemonUsage).sort((a, b) => b[1] - a[1])
  ),
  itemByPokemon,
  teammates,
  teams,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');

console.log(`Wrote ${OUT}`);
console.log(`  ${total} teams`);
console.log(`  ${Object.keys(pokemonUsage).length} unique Pokemon`);
console.log(`  Top 5: ${Object.entries(usagePercent).slice(0, 5).map(([n, p]) => `${n} ${p}%`).join(', ')}`);
