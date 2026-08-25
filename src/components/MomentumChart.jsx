import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import ChartCard from './ChartCard.jsx';
import { fmtUsd, fmtMonth, segmentLabel, SEGMENT_COLORS } from '../lib/format.js';

const OTHER_KEY = '__other';
const OTHER_COLOR = '#6b7688';

const isCounted = (d) => d.amount_disclosed && d.is_equity && Number.isFinite(d.amount_usd);

// Continuous month buckets across the TTM window (mirrors monthlySeries).
function monthsInWindow(window) {
  const months = [];
  if (!window?.start || !window?.end) return months;
  const start = new Date(window.start + 'T00:00:00Z');
  const end = new Date(window.end + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return months;
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    months.push(cur.toISOString().slice(0, 7));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return months;
}

// Per-month, per-segment rollup: usd = disclosed equity capital, count = deals.
function groupMonthSegment(deals, months) {
  const map = new Map(months.map((m) => [m, new Map()]));
  for (const d of deals) {
    const bucket = map.get(d.month);
    if (!bucket) continue;
    const seg = d.primary_segment ?? OTHER_KEY;
    if (!bucket.has(seg)) bucket.set(seg, { usd: 0, count: 0 });
    const g = bucket.get(seg);
    g.count += 1;
    if (isCounted(d)) g.usd += d.amount_usd;
  }
  return map;
}

function CustomTooltip({ active, payload, label, metric, meta }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .map((p) => ({ key: p.dataKey, value: p.value ?? 0, color: p.color }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div
      className="panel tnum"
      style={{ padding: '10px 12px', fontSize: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.3)', pointerEvents: 'none' }}
    >
      <div className="eyebrow" style={{ marginBottom: 6 }}>{fmtMonth(label)}</div>
      {rows.length === 0 && (
        <div style={{ color: 'var(--text-faint)' }}>
          {metric === 'usd' ? 'No disclosed equity capital' : 'No deals'}
        </div>
      )}
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '1.5px 0' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: r.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-dim)', marginRight: 'auto', paddingRight: 14 }}>
            {r.key === OTHER_KEY ? 'Other' : segmentLabel(meta, r.key)}
          </span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>
            {metric === 'usd' ? fmtUsd(r.value) : r.value}
          </span>
        </div>
      ))}
      {rows.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 6, paddingTop: 6,
          borderTop: '1px solid var(--border-soft)', color: 'var(--text-dim)',
        }}>
          <span>Total</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
            {metric === 'usd' ? fmtUsd(total) : total}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MomentumChart({ deals, window: win, meta, toggleValue, filters }) {
  const [metric, setMetric] = useState('usd'); // 'usd' | 'count'
  const activeSegments = filters?.segments ?? [];

  const model = useMemo(() => {
    const months = monthsInWindow(win);
    const byMonthSeg = groupMonthSegment(deals ?? [], months);

    // Top 5 segments by total disclosed equity capital in view (count as tiebreaker).
    const totals = new Map();
    for (const d of deals ?? []) {
      const seg = d.primary_segment;
      if (!seg) continue;
      if (!totals.has(seg)) totals.set(seg, { usd: 0, count: 0 });
      const t = totals.get(seg);
      t.count += 1;
      if (isCounted(d)) t.usd += d.amount_usd;
    }
    const ranked = [...totals.entries()].sort(
      (a, b) => b[1].usd - a[1].usd || b[1].count - a[1].count,
    );
    const top5 = ranked.slice(0, 5).map(([k]) => k);
    const topSet = new Set(top5);
    const hasOther = ranked.length > top5.length
      || (deals ?? []).some((d) => !d.primary_segment);

    // Stack keys drawn largest-first at the bottom; every row fully numeric.
    const stackKeys = hasOther ? [...top5, OTHER_KEY] : top5;
    const series = months.map((m) => {
      const row = { month: m };
      for (const k of stackKeys) row[k] = 0;
      const bucket = byMonthSeg.get(m);
      if (bucket) {
        for (const [seg, g] of bucket) {
          const key = topSet.has(seg) ? seg : OTHER_KEY;
          if (!(key in row)) continue; // seg landed outside stack keys (no Other lane)
          const v = metric === 'usd' ? g.usd : g.count;
          row[key] += Number.isFinite(v) && v > 0 ? v : 0;
        }
      }
      return row;
    });

    // H1 -> H2 disclosed-capital rotation per segment.
    const mid = Math.ceil(months.length / 2);
    const h1Months = new Set(months.slice(0, mid));
    const h2Months = new Set(months.slice(mid));
    const halves = new Map();
    for (const d of deals ?? []) {
      if (!isCounted(d) || !d.primary_segment) continue;
      if (!halves.has(d.primary_segment)) halves.set(d.primary_segment, { h1: 0, h2: 0 });
      const h = halves.get(d.primary_segment);
      if (h1Months.has(d.month)) h.h1 += d.amount_usd;
      else if (h2Months.has(d.month)) h.h2 += d.amount_usd;
    }
    const rotation = [...halves.entries()]
      .map(([seg, { h1, h2 }]) => {
        let delta = null; // fraction, or null when undefined
        let kind; // 'new' | 'gone' | 'flat' | 'pct'
        if (h1 > 0) {
          delta = (h2 - h1) / h1;
          kind = 'pct';
        } else if (h2 > 0) {
          kind = 'new';
        } else {
          kind = 'flat';
        }
        return { seg, h1, h2, delta, kind };
      })
      .filter((r) => r.h1 > 0 || r.h2 > 0)
      .sort((a, b) => (b.h1 + b.h2) - (a.h1 + a.h2));

    return { months, series, top5, hasOther, rotation };
  }, [deals, win, metric]);

  const { series, top5, hasOther, rotation } = model;
  const isEmpty = !deals || deals.length === 0;

  const yTick = (v) => (metric === 'usd' ? fmtUsd(v) : String(v));
  const xTickEvery = Math.max(1, Math.floor(model.months.length / 12));

  const glyph = (r) => {
    if (r.kind === 'new') return { g: '●', color: 'var(--accent)' };
    if (r.kind === 'flat') return { g: '◆', color: 'var(--text-faint)' };
    if (r.delta > 0.02) return { g: '▲', color: 'var(--accent)' };
    if (r.delta < -0.02) return { g: '▼', color: '#e06c9f' };
    return { g: '◆', color: 'var(--text-faint)' };
  };
  const deltaText = (r) => {
    if (r.kind === 'new') return 'new';
    if (r.kind === 'flat') return '—';
    const pct = r.delta * 100;
    const s = Math.abs(pct) >= 100 ? pct.toFixed(0) : pct.toFixed(1);
    return `${pct > 0 ? '+' : ''}${s}%`;
  };

  return (
    <ChartCard
      eyebrow="Momentum"
      title="Where capital is rotating"
      subtitle="Monthly disclosed equity capital, stacked by top segments"
      exportName="momentum"
      right={
        <div style={{ display: 'inline-flex', gap: 5 }}>
          <button
            className="chip tnum"
            data-active={metric === 'usd'}
            onClick={() => setMetric('usd')}
            title="Stack disclosed equity capital ($) per month"
          >
            $
          </button>
          <button
            className="chip tnum"
            data-active={metric === 'count'}
            onClick={() => setMetric('count')}
            title="Stack deal count (#) per month"
          >
            #
          </button>
        </div>
      }
    >
      {isEmpty ? (
        <div
          className="fade-enter"
          style={{
            height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-faint)', fontSize: 12,
          }}
        >
          No deals match the current filters.
        </div>
      ) : (
        <div className="fade-enter">
          <div style={{ width: '100%', height: 235 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} strokeDasharray="0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={fmtMonth}
                  interval={xTickEvery - 1}
                  tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                  axisLine={{ stroke: 'var(--border-soft)' }}
                  tickLine={false}
                  tickMargin={7}
                />
                <YAxis
                  tickFormatter={yTick}
                  width={metric === 'usd' ? 46 : 30}
                  tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<CustomTooltip metric={metric} meta={meta} />}
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                  isAnimationActive={false}
                />
                {top5.map((k) => (
                  <Area
                    key={k}
                    dataKey={k}
                    stackId="cap"
                    type="monotone"
                    stroke={SEGMENT_COLORS[k] ?? OTHER_COLOR}
                    strokeWidth={1.25}
                    fill={SEGMENT_COLORS[k] ?? OTHER_COLOR}
                    fillOpacity={0.32}
                    isAnimationActive={false}
                  />
                ))}
                {hasOther && (
                  <Area
                    dataKey={OTHER_KEY}
                    stackId="cap"
                    type="monotone"
                    stroke={OTHER_COLOR}
                    strokeWidth={1}
                    strokeOpacity={0.6}
                    fill={OTHER_COLOR}
                    fillOpacity={0.5}
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* legend chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {top5.map((k) => (
              <button
                key={k}
                className="chip"
                data-active={activeSegments.includes(k)}
                onClick={() => toggleValue?.('segments', k)}
                title={`Filter to ${segmentLabel(meta, k)}`}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: 999,
                  background: SEGMENT_COLORS[k] ?? OTHER_COLOR, flexShrink: 0,
                }} />
                {segmentLabel(meta, k)}
              </button>
            ))}
            {hasOther && (
              <span
                className="chip"
                style={{ cursor: 'default' }}
                title="All remaining segments, aggregated"
              >
                <span style={{
                  width: 7, height: 7, borderRadius: 999,
                  background: OTHER_COLOR, opacity: 0.6, flexShrink: 0,
                }} />
                Other
              </span>
            )}
          </div>

          {/* H1 -> H2 rotation table */}
          {rotation.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
              <div className="eyebrow" style={{ marginBottom: 7 }}>H1 → H2 disclosed capital</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tnum" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Segment', 'H1', 'H2', 'Δ'].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            textAlign: i === 0 ? 'left' : 'right',
                            fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                            textTransform: 'uppercase', color: 'var(--text-faint)',
                            padding: '3px 8px 5px 0', whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rotation.map((r) => {
                      const g = glyph(r);
                      return (
                        <tr
                          key={r.seg}
                          className="cell-clickable"
                          onClick={() => toggleValue?.('segments', r.seg)}
                          title={`Filter to ${segmentLabel(meta, r.seg)}`}
                          style={{ borderTop: '1px solid var(--border-soft)' }}
                        >
                          <td style={{ padding: '5px 8px 5px 0', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                              <span style={{
                                width: 7, height: 7, borderRadius: 999,
                                background: SEGMENT_COLORS[r.seg] ?? OTHER_COLOR, flexShrink: 0,
                              }} />
                              {segmentLabel(meta, r.seg)}
                            </span>
                          </td>
                          <td style={{ padding: '5px 8px 5px 0', textAlign: 'right', color: 'var(--text)' }}>
                            {r.h1 > 0 ? fmtUsd(r.h1) : '—'}
                          </td>
                          <td style={{ padding: '5px 8px 5px 0', textAlign: 'right', color: 'var(--text)' }}>
                            {r.h2 > 0 ? fmtUsd(r.h2) : '—'}
                          </td>
                          <td style={{ padding: '5px 0 5px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ color: g.color, fontSize: 10, marginRight: 5 }}>{g.g}</span>
                            <span style={{ color: r.kind === 'new' ? 'var(--accent)' : 'var(--text-dim)' }}>
                              {deltaText(r)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </ChartCard>
  );
}
