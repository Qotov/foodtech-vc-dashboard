#!/usr/bin/env node
/**
 * 2-normalize.mjs — turn hand-curated raw deals into the dashboard dataset.
 *
 *   data/raw/curated/deals.yaml  +  config/taxonomy.yaml  +  config/fx-rates.yaml
 *      -> data/processed/deals.json   (one clean record per round)
 *      -> data/processed/meta.json    (build metadata + coverage stats)
 *
 * Everything the dashboard shows is derived here so the taxonomy file stays the
 * single source of truth. Re-runnable: `npm run pipeline`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const readYaml = (p) => YAML.parse(read(p));

const taxonomy = readYaml('pipeline/config/taxonomy.yaml');
const fxTable = readYaml('pipeline/config/fx-rates.yaml');
const raw = readYaml('data/raw/curated/deals.yaml');
let overrides = {};
try { overrides = readYaml('pipeline/config/overrides.yaml')?.overrides ?? {}; } catch { /* optional */ }

const TTM = taxonomy.conventions.ttm_window.split('..').map((s) => s.trim());
const [TTM_START, TTM_END] = TTM;
// Headline capital = all rounds EXCEPT debt and grants. A disclosed round whose
// stage the source left unspecified ("Unknown") is still equity capital and must
// not be dropped from sums just for lacking a series letter.
const NON_EQUITY = new Set(['Debt', 'Grant']);
const isEquity = (stage) => !NON_EQUITY.has(stage);

// --- helpers ---------------------------------------------------------------
const warnings = [];
const warn = (m) => warnings.push(m);

const slug = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');

function canonicalStage(stageRaw, stageExplicit) {
  if (stageExplicit) return stageExplicit; // record already set the canonical value
  if (!stageRaw) return 'Unknown';
  const key = String(stageRaw).toLowerCase().trim();
  if (taxonomy.stages.includes(stageRaw)) return stageRaw;
  const alias = taxonomy.stage_aliases[key];
  if (alias) return alias;
  // try direct canonical match, case-insensitive
  const direct = taxonomy.stages.find((s) => s.toLowerCase() === key);
  return direct ?? 'Unknown';
}

// country -> region from taxonomy.regions
const countryToRegion = {};
for (const [region, countries] of Object.entries(taxonomy.regions)) {
  for (const c of countries) countryToRegion[c] = region;
}
function regionFor(country) {
  if (!country) return 'Other';
  return countryToRegion[country] ?? 'Other';
}

function fxRate(currency, isoDate) {
  if (!currency || currency === 'USD') return 1;
  const tbl = fxTable[currency];
  if (!tbl) { warn(`No FX table for currency ${currency}; treated 1:1`); return 1; }
  const ym = isoDate?.slice(0, 7);
  return tbl[ym] ?? tbl.default;
}

function inWindow(date) {
  return date >= TTM_START && date <= TTM_END;
}

// --- normalize each record -------------------------------------------------
const seen = new Map(); // dedupe key -> record
const deals = [];

for (const d of raw.deals) {
  const ov = overrides[d.company] ?? {};
  const rec = { ...d, ...ov };

  const date = rec.date;
  const stage = canonicalStage(rec.stage_raw, rec.stage);
  if (stage === 'Unknown') warn(`Unmapped stage "${rec.stage_raw}" for ${rec.company}`);

  const country = rec.hq_country ?? null;
  const region = regionFor(country);
  if (region === 'Other' && country) warn(`Country ${country} (${rec.company}) not in any region`);

  // amount handling — never impute
  const amountDisclosed = rec.amount != null && rec.amount.value != null;
  let amountUsd = null, fxUsed = null;
  if (amountDisclosed) {
    fxUsed = fxRate(rec.amount.currency, date);
    amountUsd = Math.round(rec.amount.value * fxUsed);
  }

  // segments
  const segments = rec.segments ?? [];
  const primary = rec.primary_segment ?? segments[0] ?? null;
  for (const s of segments) if (!taxonomy.segments[s]) warn(`Unknown segment "${s}" for ${rec.company}`);

  const investors = rec.investors ?? [];
  const leads = rec.lead_investors ?? [];
  const investorCount = investors.length || null;

  const record = {
    id: `${slug(rec.company)}-${(date || '').slice(0, 7)}-${slug(stage)}`,
    company: rec.company,
    date,
    date_precision: rec.date_precision ?? 'day',
    date_basis: rec.date_basis ?? 'announcement',
    month: (date || '').slice(0, 7),
    stage_raw: rec.stage_raw ?? null,
    stage,
    is_equity: isEquity(stage),
    amount_raw: rec.amount ?? null,
    amount_usd: amountUsd,
    fx_rate: fxUsed,
    fx_rate_date: amountDisclosed ? date : null,
    amount_disclosed: amountDisclosed,
    valuation_usd: rec.valuation_usd ?? null,
    lead_investors: leads,
    investors,
    investor_count: investorCount,
    investors_partial: rec.investors_partial ?? false,
    hq_city: rec.hq_city ?? null,
    hq_country: country,
    region,
    segments,
    primary_segment: primary,
    sources: rec.sources ?? [],
    confidence: rec.confidence ?? 'low',
    verify: rec.verify ?? false,
    notes: rec.notes ?? null,
  };

  if (!inWindow(date)) { warn(`${rec.company} date ${date} outside TTM window; skipped`); continue; }

  // dedupe: same company + amount within 10% + within 45 days
  const dupKey = slug(rec.company);
  if (seen.has(dupKey)) {
    const prior = seen.get(dupKey);
    const dAmt = record.amount_usd && prior.amount_usd
      ? Math.abs(record.amount_usd - prior.amount_usd) / Math.max(record.amount_usd, prior.amount_usd)
      : 1;
    const dDays = Math.abs(new Date(record.date) - new Date(prior.date)) / 86400000;
    if (dAmt < 0.1 && dDays < 45) {
      warn(`Possible duplicate merged: ${rec.company} (${prior.date} / ${record.date})`);
      continue;
    }
  }
  seen.set(dupKey, record);
  deals.push(record);
}

deals.sort((a, b) => (a.date < b.date ? 1 : -1));

// --- coverage stats --------------------------------------------------------
const disclosed = deals.filter((d) => d.amount_disclosed);
const equityDisclosed = disclosed.filter((d) => d.is_equity);
const totalUsd = equityDisclosed.reduce((s, d) => s + d.amount_usd, 0);

const meta = {
  built_at: new Date().toISOString(),
  ttm_window: { start: TTM_START, end: TTM_END },
  deal_count: deals.length,
  disclosed_count: disclosed.length,
  undisclosed_count: deals.length - disclosed.length,
  equity_deal_count: deals.filter((d) => d.is_equity).length,
  headline_capital_usd: totalUsd,
  headline_note:
    'Headline capital = disclosed equity rounds only (Pre-seed..Growth). Debt, grants, and undisclosed amounts excluded.',
  taxonomy_version: taxonomy.conventions.ttm_window,
  confidence_breakdown: countBy(deals, (d) => d.confidence),
  segments: taxonomy.segments,
  stages: taxonomy.stages,
  regions: Object.keys(taxonomy.regions).concat('Other'),
  warnings_count: warnings.length,
};

function countBy(arr, fn) {
  const o = {};
  for (const x of arr) { const k = fn(x); o[k] = (o[k] ?? 0) + 1; }
  return o;
}

// --- write -----------------------------------------------------------------
const outDir = path.join(root, 'data/processed');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'deals.json'), JSON.stringify(deals, null, 2));
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
fs.writeFileSync(path.join(outDir, 'warnings.json'), JSON.stringify(warnings, null, 2));

// also mirror into src so Vite bundles a static copy
const srcData = path.join(root, 'src/data');
fs.mkdirSync(srcData, { recursive: true });
fs.copyFileSync(path.join(outDir, 'deals.json'), path.join(srcData, 'deals.json'));
fs.copyFileSync(path.join(outDir, 'meta.json'), path.join(srcData, 'meta.json'));

console.log(`normalized ${deals.length} deals (${disclosed.length} disclosed, ${meta.undisclosed_count} undisclosed)`);
console.log(`headline capital (disclosed equity): $${(totalUsd / 1e6).toFixed(1)}M`);
console.log(`${warnings.length} warnings -> data/processed/warnings.json`);
