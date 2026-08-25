// Signal computation for the Insights panel. Pure functions, no React.
// computeInsights(deals, allDeals, window, meta?) → up to 8 insight objects:
// { id, eyebrow, headline, body, spark?, action?, tone }
//   headline: the stat ("$212M", "3.2×", "41% of capital")
//   body:     one analyst sentence explaining why it matters
//   spark:    optional array of monthly numbers for a sparkline
//   action:   optional { type: 'segments'|'stages'|'regions', value }
//   tone:     'up' | 'down' | 'flat' | 'warn'

import { fmtUsd, fmtMonth, median, segmentLabel } from './format.js';

const DE = (arr) => arr.filter((d) => d.amount_disclosed && d.is_equity);
const sum = (arr) => arr.reduce((s, n) => s + n, 0);
const pctStr = (r) => `${r >= 0 ? '+' : '−'}${Math.abs(Math.round(r * 100))}%`;

// ---- date helpers ----------------------------------------------------------

function monthKeys(win) {
  const out = [];
  const [sy, sm] = win.start.split('-').map(Number);
  const [ey, em] = win.end.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

function lastDayOf(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// a month is "full" when the entire calendar month sits inside the window
const isFullMonth = (key, win) =>
  `${key}-01` >= win.start && `${key}-${String(lastDayOf(key)).padStart(2, '0')}` <= win.end;

function midDate(win) {
  const t = (Date.parse(win.start + 'T00:00:00Z') + Date.parse(win.end + 'T00:00:00Z')) / 2;
  return new Date(t).toISOString().slice(0, 10);
}

// per-month disclosed-equity capital and deal counts, keyed by month
function monthlyBuckets(deals, keys) {
  const map = new Map(keys.map((k) => [k, { usd: 0, count: 0 }]));
  for (const d of deals) {
    const g = map.get(d.month);
    if (!g) continue;
    g.count += 1;
    if (d.amount_disclosed && d.is_equity) g.usd += d.amount_usd;
  }
  return map;
}

// ---- main ------------------------------------------------------------------

export function computeInsights(deals, allDeals, win, meta = {}) {
  if (!Array.isArray(deals) || deals.length < 3 || !win?.start || !win?.end) return [];

  const out = [];
  const keys = monthKeys(win);
  const buckets = monthlyBuckets(deals, keys);
  const sparkUsd = keys.map((k) => buckets.get(k).usd);
  const mid = midDate(win);
  const inView = Array.isArray(allDeals) && allDeals.length > deals.length;
  const scope = inView ? 'this view' : 'the TTM window';

  // (1) 3-month momentum — last 3 full months vs the prior 3
  const full = keys.filter((k) => isFullMonth(k, win));
  if (full.length >= 6) {
    const last3 = full.slice(-3);
    const prev3 = full.slice(-6, -3);
    const capL = sum(last3.map((k) => buckets.get(k).usd));
    const capP = sum(prev3.map((k) => buckets.get(k).usd));
    const cntL = sum(last3.map((k) => buckets.get(k).count));
    const cntP = sum(prev3.map((k) => buckets.get(k).count));
    if (cntL + cntP >= 3 && (capL > 0 || capP > 0)) {
      const r = capP > 0 ? capL / capP - 1 : null;
      const tone = r == null ? 'up' : r > 0.1 ? 'up' : r < -0.1 ? 'down' : 'flat';
      const range = `${fmtMonth(last3[0])}–${fmtMonth(last3[2])}`;
      const vs = `${fmtUsd(capL)} across ${cntL} deals vs ${fmtUsd(capP)} across ${cntP} the prior quarter`;
      const read =
        tone === 'up' ? 'capital formation is re-accelerating'
        : tone === 'down' ? 'the tape is cooling and follow-ons will get pickier'
        : 'a steady tape, no regime change';
      out.push({
        id: 'momentum',
        eyebrow: '3-month momentum',
        headline: r == null ? `${fmtUsd(capL)} capital` : `${pctStr(r)} capital`,
        body: `${range} booked ${vs} — ${read}.`,
        spark: sparkUsd,
        action: null,
        tone,
      });
    }
  }

  // (2)+(3) hottest and fading segments by H2-vs-H1 disclosed capital
  const segAgg = new Map();
  for (const d of deals) {
    const k = d.primary_segment;
    if (!k) continue;
    if (!segAgg.has(k)) segAgg.set(k, { key: k, count: 0, h1: 0, h2: 0 });
    const g = segAgg.get(k);
    g.count += 1;
    if (d.amount_disclosed && d.is_equity) {
      if (d.date <= mid) g.h1 += d.amount_usd; else g.h2 += d.amount_usd;
    }
  }
  const segs = [...segAgg.values()].filter((g) => g.count >= 3 && g.h1 + g.h2 > 0);
  const segSpark = (key) =>
    keys.map((k) => sum(DE(deals.filter((d) => d.primary_segment === key && d.month === k)).map((d) => d.amount_usd)));

  const hotCands = segs
    .filter((g) => g.h2 > 0 && (g.h1 === 0 ? g.h2 >= 1e6 : g.h2 / g.h1 >= 1.25))
    .sort((a, b) => {
      const ra = a.h1 > 0 ? a.h2 / a.h1 : Infinity;
      const rb = b.h1 > 0 ? b.h2 / b.h1 : Infinity;
      return rb - ra || b.h2 - a.h2;
    });
  if (hotCands.length) {
    const g = hotCands[0];
    const label = segmentLabel(meta, g.key);
    const ratio = g.h1 > 0 ? g.h2 / g.h1 : null;
    out.push({
      id: 'hot-segment',
      eyebrow: 'Hottest segment',
      headline: ratio ? `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× H1→H2` : `${fmtUsd(g.h2)} from $0`,
      body: ratio
        ? `${label} disclosed capital went ${fmtUsd(g.h1)} → ${fmtUsd(g.h2)} half-over-half on ${g.count} deals — money is rotating in.`
        : `${label} went from zero to ${fmtUsd(g.h2)} in H2 across ${g.count} deals — a cold start turning hot.`,
      spark: segSpark(g.key),
      action: { type: 'segments', value: g.key },
      tone: 'up',
    });
  }

  const coldCands = segs
    .filter((g) => g.h1 > 0 && g.h2 < g.h1 * 0.75)
    .sort((a, b) => a.h2 / a.h1 - b.h2 / b.h1 || b.h1 - a.h1);
  if (coldCands.length) {
    const g = coldCands[0];
    const label = segmentLabel(meta, g.key);
    const drop = 1 - g.h2 / g.h1;
    out.push({
      id: 'cold-segment',
      eyebrow: 'Fading segment',
      headline: `−${Math.round(drop * 100)}% H2`,
      body: `${label} slid ${fmtUsd(g.h1)} → ${fmtUsd(g.h2)} H1→H2 across ${g.count} deals — conviction is thinning.`,
      spark: segSpark(g.key),
      action: { type: 'segments', value: g.key },
      tone: 'down',
    });
  }

  // (4) median check trend for the most active priced stage
  const skipStages = new Set(['Debt', 'Grant', 'Unknown']);
  const stageAmts = new Map();
  for (const d of DE(deals)) {
    if (skipStages.has(d.stage)) continue;
    if (!stageAmts.has(d.stage)) stageAmts.set(d.stage, []);
    stageAmts.get(d.stage).push(d);
  }
  const topStage = [...stageAmts.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (topStage) {
    const [stage, ds] = topStage;
    const h1a = ds.filter((d) => d.date <= mid).map((d) => d.amount_usd);
    const h2a = ds.filter((d) => d.date > mid).map((d) => d.amount_usd);
    if (ds.length >= 4 && h1a.length >= 2 && h2a.length >= 2) {
      const m1 = median(h1a);
      const m2 = median(h2a);
      if (m1 > 0 && m2 != null) {
        const r = m2 / m1 - 1;
        const tone = r > 0.15 ? 'up' : r < -0.15 ? 'down' : 'flat';
        const read =
          tone === 'up' ? `the bar to raise a ${stage} is rising`
          : tone === 'down' ? 'pricing discipline is back'
          : 'check sizes are holding steady';
        out.push({
          id: 'median-trend',
          eyebrow: `${stage} check size`,
          headline: `${fmtUsd(m2)} median`,
          body: `${stage} medians moved ${fmtUsd(m1)} → ${fmtUsd(m2)} H1→H2 (${pctStr(r)}) across ${ds.length} priced rounds — ${read}.`,
          spark: keys.map((k) => median(ds.filter((d) => d.month === k).map((d) => d.amount_usd)) ?? 0),
          action: { type: 'stages', value: stage },
          tone,
        });
      }
    }
  }

  // (5) top-5 concentration, top deal named
  const de = DE(deals).sort((a, b) => b.amount_usd - a.amount_usd);
  const total = sum(de.map((d) => d.amount_usd));
  if (de.length >= 5 && total > 0) {
    const top5 = de.slice(0, 5);
    const share = sum(top5.map((d) => d.amount_usd)) / total;
    const top = top5[0];
    const tone = share >= 0.5 ? 'warn' : 'flat';
    const read = share >= 0.5
      ? 'headline totals ride on a handful of mega-rounds'
      : share <= 0.35
        ? 'capital is unusually well spread for a niche market'
        : 'a normal top-heavy tape, nothing distorting the totals';
    out.push({
      id: 'concentration',
      eyebrow: 'Top-5 concentration',
      headline: `${Math.round(share * 100)}% of capital`,
      body: `The five largest rounds hold ${Math.round(share * 100)}% of ${fmtUsd(total)} disclosed, led by ${top.company}'s ${fmtUsd(top.amount_usd)} ${top.stage} — ${read}.`,
      spark: null,
      action: null,
      tone,
    });
  }

  // (6) undisclosed-rate data-quality note
  const undisc = deals.filter((d) => !d.amount_disclosed).length;
  if (undisc > 0) {
    const rate = undisc / deals.length;
    out.push({
      id: 'undisclosed',
      eyebrow: 'Data quality',
      headline: `${Math.round(rate * 100)}% undisclosed`,
      body: `${undisc} of ${deals.length} rounds in ${scope} never priced publicly — capital sums are a floor, not a census.`,
      spark: null,
      action: null,
      tone: rate >= 0.2 ? 'warn' : 'flat',
    });
  }

  // (7) busiest hub city
  const cityMap = new Map();
  for (const d of deals) {
    if (!d.hq_city) continue;
    const k = `${d.hq_city}|${d.hq_country}`;
    if (!cityMap.has(k)) cityMap.set(k, { city: d.hq_city, count: 0, usd: 0 });
    const g = cityMap.get(k);
    g.count += 1;
    if (d.amount_disclosed && d.is_equity) g.usd += d.amount_usd;
  }
  const cities = [...cityMap.values()].sort((a, b) => b.count - a.count || b.usd - a.usd);
  if (cities.length && cities[0].count >= 3) {
    const [top, next] = cities;
    const vs = next ? `, ahead of ${next.city} at ${next.count}` : '';
    out.push({
      id: 'hub',
      eyebrow: 'Busiest hub',
      headline: top.city,
      body: `${top.count} rounds and ${fmtUsd(top.usd)} disclosed came out of ${top.city}${vs} — the densest node on the map.`,
      spark: null,
      action: null,
      tone: 'flat',
    });
  }

  // (8) most active lead investor
  const leadMap = new Map();
  for (const d of deals) {
    for (const inv of d.lead_investors ?? []) {
      if (!leadMap.has(inv)) leadMap.set(inv, { investor: inv, leads: 0, usd: 0, segs: new Map() });
      const g = leadMap.get(inv);
      g.leads += 1;
      if (d.amount_disclosed && d.is_equity) g.usd += d.amount_usd;
      if (d.primary_segment) g.segs.set(d.primary_segment, (g.segs.get(d.primary_segment) ?? 0) + 1);
    }
  }
  const leads = [...leadMap.values()].sort((a, b) => b.leads - a.leads || b.usd - a.usd);
  if (leads.length && leads[0].leads >= 2) {
    const g = leads[0];
    const focus = [...g.segs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const focusTxt = focus ? `, leaning ${segmentLabel(meta, focus)}` : '';
    out.push({
      id: 'lead-investor',
      eyebrow: 'Most active lead',
      headline: g.investor,
      body: `Led ${g.leads} of ${deals.length} rounds (${fmtUsd(g.usd)} disclosed)${focusTxt} — nobody is writing more term sheets in ${scope}.`,
      spark: null,
      action: null,
      tone: 'up',
    });
  }

  return out.slice(0, 8);
}
