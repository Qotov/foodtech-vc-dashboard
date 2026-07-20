#!/usr/bin/env node
/**
 * 3-qa-report.mjs — human-readable QA + coverage report over the normalized set.
 * Prints to stdout and writes docs/qa-report.md so caveats are auditable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const deals = JSON.parse(fs.readFileSync(path.join(root, 'data/processed/deals.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/processed/meta.json'), 'utf8'));
const warnings = JSON.parse(fs.readFileSync(path.join(root, 'data/processed/warnings.json'), 'utf8'));

const groupCount = (arr, fn) => {
  const o = {};
  for (const x of arr) { const k = fn(x) ?? '—'; o[k] = (o[k] ?? 0) + 1; }
  return Object.entries(o).sort((a, b) => b[1] - a[1]);
};

const disclosed = deals.filter((d) => d.amount_disclosed && d.is_equity);
const totalUsd = disclosed.reduce((s, d) => s + d.amount_usd, 0);
const top5 = [...disclosed].sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 5);
const top5Sum = top5.reduce((s, d) => s + d.amount_usd, 0);
const verifyQueue = deals.filter((d) => d.verify);

const fmt$ = (n) => `$${(n / 1e6).toFixed(1)}M`;
const lines = [];
const p = (s = '') => lines.push(s);

p(`# QA & coverage report`);
p();
p(`_Built ${meta.built_at} · TTM ${meta.ttm_window.start} → ${meta.ttm_window.end}_`);
p();
p(`## Headline`);
p(`- **${meta.deal_count}** deals in window`);
p(`- **${meta.disclosed_count}** disclosed / **${meta.undisclosed_count}** undisclosed amounts`);
p(`- **${fmt$(totalUsd)}** headline capital (disclosed equity rounds only)`);
p(`- Top-5 deals = **${((top5Sum / totalUsd) * 100).toFixed(1)}%** of disclosed equity capital → concentration flag`);
p();
p(`## Confidence mix`);
for (const [k, v] of Object.entries(meta.confidence_breakdown)) p(`- ${k}: ${v}`);
p();
p(`## ${verifyQueue.length} records flagged for individual verification`);
p(`These carry \`verify: true\` — extracted from weekly roundups with ambiguous`);
p(`stage/amount/HQ and not yet cross-checked against a primary source.`);
for (const d of verifyQueue) p(`- ${d.company} (${d.date}, ${d.stage}) — ${d.notes ?? 'roundup extraction'}`);
p();
p(`## Deals by stage`);
for (const [k, v] of groupCount(deals, (d) => d.stage)) p(`- ${k}: ${v}`);
p();
p(`## Deals by region`);
for (const [k, v] of groupCount(deals, (d) => d.region)) p(`- ${k}: ${v}`);
p();
p(`## Deals by primary segment`);
for (const [k, v] of groupCount(deals, (d) => d.primary_segment)) p(`- ${k}: ${v}`);
p();
p(`## Normalizer warnings (${warnings.length})`);
for (const w of warnings) p(`- ${w}`);
p();
p(`## Known coverage bias`);
p(`Public-source aggregation (AgFunderNews weekly roundups + trade press) over-`);
p(`represents US/EU deals, English-language coverage, larger and venture-hyped`);
p(`rounds. It under-represents pre-seed/angel, non-English APAC/LATAM press, and`);
p(`quiet extensions. Absolute totals are **floor estimates**, not market totals.`);
p(`Consumer food delivery and grocery q-commerce are excluded by scope decision.`);

const outMd = lines.join('\n') + '\n';
fs.writeFileSync(path.join(root, 'docs/qa-report.md'), outMd);

// terminal summary
console.log(`\n=== QA SUMMARY ===`);
console.log(`${meta.deal_count} deals | ${meta.disclosed_count} disclosed | ${fmt$(totalUsd)} headline capital`);
console.log(`Top-5 concentration: ${((top5Sum / totalUsd) * 100).toFixed(1)}%`);
console.log(`Verify queue: ${verifyQueue.length} | Warnings: ${warnings.length}`);
console.log(`Report -> docs/qa-report.md`);
