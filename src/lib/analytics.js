import { STAGE_ORDER, median, mean } from './format.js';

const disclosedEquity = (deals) => deals.filter((d) => d.amount_disclosed && d.is_equity);

export function kpis(deals) {
  const de = disclosedEquity(deals);
  const total = de.reduce((s, d) => s + d.amount_usd, 0);
  const amounts = de.map((d) => d.amount_usd);
  const undisclosed = deals.filter((d) => !d.amount_disclosed).length;
  const top5 = [...de].sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 5);
  const top5Sum = top5.reduce((s, d) => s + d.amount_usd, 0);
  return {
    dealCount: deals.length,
    disclosedCount: de.length,
    undisclosedCount: undisclosed,
    totalUsd: total,
    medianUsd: median(amounts),
    meanUsd: mean(amounts),
    top5Concentration: total ? top5Sum / total : 0,
    top5,
    activeInvestors: new Set(deals.flatMap((d) => d.investors)).size,
  };
}

// generic grouped rollup: count + disclosed sum per key
export function rollup(deals, keyFn) {
  const map = new Map();
  for (const d of deals) {
    const keys = keyFn(d);
    for (const k of [].concat(keys)) {
      if (k == null) continue;
      if (!map.has(k)) map.set(k, { key: k, count: 0, usd: 0, disclosed: 0 });
      const g = map.get(k);
      g.count += 1;
      if (d.amount_disclosed && d.is_equity) { g.usd += d.amount_usd; g.disclosed += 1; }
    }
  }
  return [...map.values()];
}

export function byStage(deals) {
  const r = rollup(deals, (d) => d.stage);
  return r.sort((a, b) => STAGE_ORDER.indexOf(a.key) - STAGE_ORDER.indexOf(b.key));
}

export function bySegment(deals) {
  return rollup(deals, (d) => d.primary_segment).sort((a, b) => b.usd - a.usd || b.count - a.count);
}

export function byRegion(deals) {
  return rollup(deals, (d) => d.region).sort((a, b) => b.usd - a.usd);
}

export function byCountry(deals) {
  return rollup(deals, (d) => d.hq_country).sort((a, b) => b.usd - a.usd);
}

export function byCity(deals) {
  const map = new Map();
  for (const d of deals) {
    if (!d.hq_city) continue;
    const k = `${d.hq_city}|${d.hq_country}`;
    if (!map.has(k)) map.set(k, { city: d.hq_city, country: d.hq_country, count: 0, usd: 0 });
    const g = map.get(k);
    g.count += 1;
    if (d.amount_disclosed && d.is_equity) g.usd += d.amount_usd;
  }
  return [...map.values()].sort((a, b) => b.usd - a.usd);
}

// per-stage distribution stats for the box/summary view
export function stageDistribution(deals) {
  const groups = new Map();
  for (const d of disclosedEquity(deals)) {
    if (!groups.has(d.stage)) groups.set(d.stage, []);
    groups.get(d.stage).push(d.amount_usd);
  }
  const out = [];
  for (const stage of STAGE_ORDER) {
    const vals = groups.get(stage);
    if (!vals || !vals.length) continue;
    const s = [...vals].sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
    out.push({
      stage, n: s.length,
      min: s[0], q1: q(0.25), median: median(s), q3: q(0.75), max: s[s.length - 1],
      mean: mean(s), values: s,
    });
  }
  return out;
}

export function monthlySeries(deals, window) {
  // build continuous month buckets across the TTM window
  const months = [];
  const start = new Date(window.start + 'T00:00:00Z');
  const end = new Date(window.end + 'T00:00:00Z');
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    months.push(cur.toISOString().slice(0, 7));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  const map = new Map(months.map((m) => [m, { month: m, count: 0, usd: 0 }]));
  for (const d of deals) {
    const g = map.get(d.month);
    if (!g) continue;
    g.count += 1;
    if (d.amount_disclosed && d.is_equity) g.usd += d.amount_usd;
  }
  return months.map((m) => map.get(m));
}

// segment × stage matrix (counts and usd)
export function crosstab(deals, rowFn, colKeys, rowKeys) {
  const cells = new Map();
  for (const d of deals) {
    const r = rowFn.row(d);
    const c = rowFn.col(d);
    if (r == null || c == null) continue;
    const k = `${r}|${c}`;
    if (!cells.has(k)) cells.set(k, { count: 0, usd: 0 });
    const g = cells.get(k);
    g.count += 1;
    if (d.amount_disclosed && d.is_equity) g.usd += d.amount_usd;
  }
  const matrix = rowKeys.map((r) => ({
    row: r,
    cells: colKeys.map((c) => ({ col: c, ...(cells.get(`${r}|${c}`) ?? { count: 0, usd: 0 }) })),
  }));
  return matrix;
}

export function topInvestors(deals, limit = 14) {
  const map = new Map();
  for (const d of deals) {
    const isLead = new Set(d.lead_investors);
    for (const inv of d.investors) {
      if (!map.has(inv)) map.set(inv, { investor: inv, deals: 0, leads: 0, usd: 0, segments: new Map() });
      const g = map.get(inv);
      g.deals += 1;
      if (isLead.has(inv)) g.leads += 1;
      if (d.amount_disclosed && d.is_equity) g.usd += d.amount_usd;
      if (d.primary_segment) g.segments.set(d.primary_segment, (g.segments.get(d.primary_segment) ?? 0) + 1);
    }
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      topSegment: [...g.segments.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.deals - a.deals || b.usd - a.usd)
    .slice(0, limit);
}
