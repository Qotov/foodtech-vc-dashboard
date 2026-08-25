#!/usr/bin/env node
/**
 * 1b-apply-enrichment.mjs — merge research-agent output into the curated set.
 *
 *   node pipeline/1b-apply-enrichment.mjs data/raw/enrichment/round1.json
 *
 * Input: { discovered: [...], corrections: [...] } (see docs/v2-spec.md
 * enrichment schemas). Applies corrections to data/raw/curated/deals.yaml,
 * appends deduped discoveries, keeps a timestamped backup, and prints a
 * change log. Field policy: a null/absent correction field = no change;
 * non-empty arrays replace; exclude=true removes the record.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const CURATED = path.join(root, 'data/raw/curated/deals.yaml');

const inputPath = process.argv[2];
if (!inputPath) { console.error('usage: node pipeline/1b-apply-enrichment.mjs <enrichment.json>'); process.exit(1); }
const { discovered = [], corrections = [] } = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const doc = YAML.parse(fs.readFileSync(CURATED, 'utf8'));
const deals = doc.deals;
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
const log = [];

// --- 1. apply corrections ---------------------------------------------------
// Disambiguation: a correction "Name (Series A)" targets the record whose
// company is "Name" closest to the parenthesized hint; otherwise match by
// company slug + closest date.
function findRecord(corrName) {
  const base = corrName.replace(/\s*\(.*\)$/, '');
  const matches = deals.filter((d) => slug(d.company) === slug(base));
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  const hint = (corrName.match(/\((.*)\)/) ?? [])[1];
  if (hint) {
    const byStage = matches.find((d) => (d.stage ?? d.stage_raw ?? '').toLowerCase().includes(hint.toLowerCase()));
    if (byStage) return byStage;
  }
  return matches[0];
}

const toRemove = new Set();
for (const c of corrections) {
  const rec = findRecord(c.company);
  if (!rec) { log.push(`?? correction for unknown company: ${c.company}`); continue; }
  if (c.exclude) {
    toRemove.add(rec);
    log.push(`-- excluded ${rec.company}: ${c.exclude_reason ?? 'out of scope'}`);
    continue;
  }
  const changes = [];
  if (c.stage && c.stage !== rec.stage) { rec.stage = c.stage; rec.stage_raw = c.stage; changes.push(`stage→${c.stage}`); }
  if (c.date && c.date !== rec.date) { rec.date = c.date; rec.date_precision = 'day'; changes.push(`date→${c.date}`); }
  if (c.amount_value != null && c.amount_currency) {
    const prev = rec.amount?.value;
    if (prev !== c.amount_value) changes.push(`amount→${c.amount_currency} ${(c.amount_value / 1e6).toFixed(1)}m`);
    rec.amount = { value: c.amount_value, currency: c.amount_currency };
  }
  if (c.lead_investors?.length) { rec.lead_investors = c.lead_investors; changes.push('leads'); }
  if (c.investors?.length) {
    rec.investors = [...new Set([...(c.investors ?? []), ...(c.lead_investors ?? [])])];
    changes.push(`investors(${rec.investors.length})`);
  }
  if (c.hq_city) rec.hq_city = c.hq_city;
  if (c.hq_country) { if (rec.hq_country !== c.hq_country) changes.push(`hq→${c.hq_country}`); rec.hq_country = c.hq_country; }
  if (c.valuation_usd != null) { rec.valuation_usd = c.valuation_usd; changes.push('valuation'); }
  if (c.primary_segment) {
    rec.primary_segment = c.primary_segment;
    if (!(rec.segments ?? []).includes(c.primary_segment)) rec.segments = [c.primary_segment, ...(rec.segments ?? [])];
  }
  if (c.description) rec.description = c.description;
  if (c.notes) rec.notes = rec.notes ? `${rec.notes}; ${c.notes}` : c.notes;
  if (c.source_url) {
    rec.sources = rec.sources ?? [];
    if (!rec.sources.some((s) => s.url === c.source_url)) {
      rec.sources.push({ name: 'Verification source', url: c.source_url, retrieved: new Date().toISOString().slice(0, 10) });
    }
  }
  if (c.verified) {
    rec.confidence = c.confidence ?? (rec.sources?.length > 1 ? 'high' : 'medium');
    delete rec.verify;
    changes.push(`✓${rec.confidence}`);
  }
  if (changes.length) log.push(`~~ ${rec.company}: ${changes.join(', ')}`);
}
doc.deals = deals.filter((d) => !toRemove.has(d));

// --- 2. append discoveries (deduped) ---------------------------------------
const have = new Set(doc.deals.map((d) => slug(d.company)));
let added = 0;
for (const n of discovered) {
  const key = slug(n.company);
  if (have.has(key)) { log.push(`== skipped duplicate discovery: ${n.company}`); continue; }
  if (!n.date || n.date < '2025-07-21' || n.date > '2026-07-20') { log.push(`== skipped out-of-window: ${n.company} (${n.date})`); continue; }
  have.add(key);
  added += 1;
  const sources = [{ name: n.source_name, url: n.source_url, retrieved: new Date().toISOString().slice(0, 10) }];
  if (n.source2_url) sources.push({ name: 'Corroborating source', url: n.source2_url, retrieved: new Date().toISOString().slice(0, 10) });
  doc.deals.push({
    company: n.company,
    date: n.date,
    date_precision: n.date_precision ?? 'day',
    date_basis: 'announcement',
    stage_raw: n.stage,
    stage: n.stage === 'Unknown' ? null : n.stage,
    amount: n.amount_value != null ? { value: n.amount_value, currency: n.amount_currency ?? 'USD' } : null,
    lead_investors: n.lead_investors ?? [],
    investors: [...new Set([...(n.investors ?? []), ...(n.lead_investors ?? [])])],
    hq_city: n.hq_city ?? null,
    hq_country: n.hq_country,
    segments: n.segments?.length ? n.segments : [n.primary_segment],
    primary_segment: n.primary_segment,
    valuation_usd: n.valuation_usd ?? null,
    description: n.description ?? null,
    sources,
    confidence: n.confidence ?? 'medium',
    notes: n.notes ?? null,
  });
}

// --- 3. write back ----------------------------------------------------------
const backup = CURATED.replace('.yaml', `.backup-${Date.now()}.yaml`);
fs.copyFileSync(CURATED, backup);
const header = `# Curated food tech VC deals — TTM 2025-07-21 .. 2026-07-20
# Hand-assembled from public sources + verified/extended by research agents.
# Normalized by pipeline/2-normalize.mjs. Fields: docs/schema.md.
# amount: {value, currency} or null (undisclosed — never imputed).
`;
fs.writeFileSync(CURATED, header + YAML.stringify({ deals: doc.deals }, { lineWidth: 120 }));

console.log(log.join('\n'));
console.log(`\n=== ${corrections.length} corrections processed, ${toRemove.size} excluded, ${added} discovered deals added ===`);
console.log(`Total curated deals: ${doc.deals.length} (backup: ${path.basename(backup)})`);
