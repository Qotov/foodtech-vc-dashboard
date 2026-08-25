import { useMemo, useRef, useState } from 'react';
import { scaleUtc, scaleSqrt } from 'd3-scale';
import ChartCard from './ChartCard.jsx';
import { bySegment } from '../lib/analytics.js';
import { SEGMENT_COLORS, fmtUsd, fmtMonth, segmentLabel } from '../lib/format.js';

// ---------------------------------------------------------------------------
// Beeswarm — every deal in the TTM window as one dot, area ∝ round size.
//   x = announcement date, y = collision-relaxed swarm offset,
//   r = sqrt(amount_usd) → [3, 26]px, undisclosed = r3 hollow circle.
// ---------------------------------------------------------------------------

const W = 1100;
const H = 360;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 318; // below this: month labels
const PAD_X = 40; // horizontal inset so a 26px dot never clips the frame
const CENTER_Y = (PLOT_TOP + PLOT_BOTTOM) / 2;
const GAP = 0.7; // breathing room between circles, px

const FALLBACK_COLOR = '#6b7688';

// deterministic per-deal jitter: string hash → LCG → [0, 1)
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function lcg01(seed) {
  const s = (Math.imul(seed || 1, 1664525) + 1013904223) >>> 0;
  return s / 4294967296;
}

// label fallback when no meta is in scope (acronyms handled)
const ACRONYMS = { d2c: 'D2C', cpg: 'CPG' };
function humanizeSegment(key) {
  if (!key) return '—';
  return key
    .split('-')
    .map((w) => ACRONYMS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function monthStarts(windowStart, windowEnd) {
  const out = [];
  const start = new Date(windowStart + 'T00:00:00Z');
  const end = new Date(windowEnd + 'T00:00:00Z');
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

// Deterministic vertical relaxation: sorted by x, pairs pushed apart until no
// circle overlaps another. Converges long before the iteration cap for real
// data densities; each node stays clamped inside the plot band.
function relax(nodes) {
  const n = nodes.length;
  if (n < 2) return;
  let rMax = 0;
  for (const nd of nodes) rMax = Math.max(rMax, nd.r);
  const clampY = (y, r) => Math.max(PLOT_TOP + r, Math.min(PLOT_BOTTOM - r, y));

  for (let iter = 0; iter < 160; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        if (dx > a.r + rMax + GAP) break; // sorted by x — nothing further can touch
        const minD = a.r + b.r + GAP;
        if (dx >= minD) continue;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy >= minD * minD) continue;
        const needY = Math.sqrt(Math.max(minD * minD - dx * dx, 0.04));
        const delta = (needY - Math.abs(dy)) / 2 + 0.03;
        const dir = dy !== 0 ? Math.sign(dy) : a.jit <= b.jit ? 1 : -1;
        a.y = clampY(a.y - dir * delta, a.r);
        b.y = clampY(b.y + dir * delta, b.r);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

export default function Beeswarm({ deals, window: ttm, onSelectDeal, filters, meta }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { deal, px, py } in wrapper px

  const label = (key) => (meta ? segmentLabel(meta, key) : humanizeSegment(key));

  const { nodes, ticks } = useMemo(() => {
    const start = ttm?.start ?? deals.reduce((m, d) => (m && m < d.date ? m : d.date), null);
    const end = ttm?.end ?? deals.reduce((m, d) => (m && m > d.date ? m : d.date), null);
    if (!start || !end) return { nodes: [], ticks: [] };

    const x = scaleUtc()
      .domain([new Date(start + 'T00:00:00Z'), new Date(end + 'T23:59:59Z')])
      .range([PAD_X, W - PAD_X]);

    const maxAmt = deals.reduce(
      (m, d) => (d.amount_disclosed && d.amount_usd > m ? d.amount_usd : m), 0);
    const rScale = scaleSqrt().domain([0, Math.max(maxAmt, 1)]).range([0, 26]).clamp(true);

    const ns = deals
      .map((d) => {
        const jit = lcg01(hashSeed(d.id ?? d.company ?? ''));
        const disclosed = !!d.amount_disclosed;
        const r = disclosed ? Math.max(3, rScale(d.amount_usd)) : 3;
        const cx = Math.max(PAD_X, Math.min(W - PAD_X, x(new Date(d.date + 'T00:00:00Z'))));
        return { deal: d, x: cx, y: CENTER_Y + (jit - 0.5) * 22, r, jit, disclosed };
      })
      .sort((a, b) => a.x - b.x || a.jit - b.jit);

    relax(ns);
    for (const nd of ns) {
      nd.y = Math.max(PLOT_TOP + nd.r, Math.min(PLOT_BOTTOM - nd.r, nd.y));
    }

    const tickDates = monthStarts(start, end);
    const tks = tickDates.map((dt, i) => {
      const next = tickDates[i + 1];
      const x0 = x(dt);
      const x1 = next ? x(next) : x.range()[1];
      return { key: dt.toISOString().slice(0, 7), x: x0, mid: (Math.max(x0, PAD_X) + Math.min(x1, W - PAD_X)) / 2 };
    });
    return { nodes: ns, ticks: tks };
  }, [deals, ttm?.start, ttm?.end]);

  const legend = useMemo(
    () => bySegment(deals).filter((s) => s.count > 0).slice(0, 6),
    [deals]
  );

  const activeSegs = filters?.segments ?? [];
  const segMode = filters?.segmentMode ?? 'primary';
  const matchesFilter = (d) => {
    if (!activeSegs.length) return true;
    const pool = segMode === 'any' ? d.segments ?? [] : [d.primary_segment];
    return activeSegs.some((s) => pool.includes(s));
  };

  const moveTooltip = (e, deal) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ deal, px: e.clientX - rect.left, py: e.clientY - rect.top, w: rect.width });
  };

  const hoveredId = hover?.deal?.id;
  const hoveredNode = hoveredId ? nodes.find((n) => n.deal.id === hoveredId) : null;
  const flip = hover && hover.px > hover.w * 0.62;

  return (
    <ChartCard
      eyebrow="The market at a glance"
      title="Every deal, to scale"
      subtitle="One dot per round · area = disclosed size · hollow = undisclosed · click a dot for details"
      exportName="beeswarm"
    >
      {nodes.length === 0 ? (
        <div
          className="flex items-center justify-center text-[13px]"
          style={{ height: 240, color: 'var(--text-dim)' }}
        >
          No deals match the current filters.
        </div>
      ) : (
        <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: 'block', aspectRatio: `${W} / ${H}` }}
          >
            {/* month gridlines + labels */}
            {ticks.map((t) => (
              <g key={t.key}>
                <line
                  x1={t.x} x2={t.x} y1={PLOT_TOP - 4} y2={PLOT_BOTTOM + 6}
                  stroke="var(--grid)" strokeWidth="1"
                />
                <text
                  x={t.mid} y={H - 16} textAnchor="middle" fontSize="10"
                  fill="var(--text-faint)" className="tnum"
                >
                  {fmtMonth(t.key)}
                </text>
              </g>
            ))}
            <line
              x1={PAD_X - 12} x2={W - PAD_X + 12} y1={PLOT_BOTTOM + 6} y2={PLOT_BOTTOM + 6}
              stroke="var(--border)" strokeWidth="1"
            />

            {/* dots */}
            {nodes.map((n) => {
              const d = n.deal;
              const color = SEGMENT_COLORS[d.primary_segment] ?? FALLBACK_COLOR;
              const dim = !matchesFilter(d);
              const isHover = hoveredId === d.id;
              return (
                <circle
                  key={d.id}
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.disclosed ? color : 'none'}
                  fillOpacity={n.disclosed ? 0.88 : 0}
                  stroke={n.disclosed ? 'none' : color}
                  strokeWidth={n.disclosed ? 0 : 1.4}
                  opacity={isHover ? 1 : dim ? 0.25 : 1}
                  style={{ cursor: 'pointer', transition: 'opacity 0.12s ease' }}
                  onMouseEnter={(e) => moveTooltip(e, d)}
                  onMouseMove={(e) => moveTooltip(e, d)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelectDeal?.(d)}
                />
              );
            })}

            {/* hover highlight ring, drawn last so it sits above neighbours */}
            {hoveredNode && (
              <circle
                cx={hoveredNode.x}
                cy={hoveredNode.y}
                r={hoveredNode.r + 1.5}
                fill="none"
                stroke="var(--text)"
                strokeWidth="1.5"
                pointerEvents="none"
              />
            )}
          </svg>

          {/* tooltip */}
          {hover && (
            <div
              className="fade-enter"
              style={{
                position: 'absolute',
                left: flip ? undefined : hover.px + 14,
                right: flip ? hover.w - hover.px + 14 : undefined,
                top: Math.max(4, hover.py - 12),
                zIndex: 10,
                pointerEvents: 'none',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '8px 11px',
                boxShadow: '0 10px 32px rgba(0,0,0,0.30)',
                maxWidth: 240,
              }}
            >
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                {hover.deal.company}
              </div>
              <div className="text-xs tnum mt-0.5" style={{ color: 'var(--text)' }}>
                {hover.deal.amount_disclosed ? fmtUsd(hover.deal.amount_usd) : 'undisclosed'}
                <span style={{ color: 'var(--text-dim)' }}> · {hover.deal.stage}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px]" style={{ color: 'var(--text-dim)' }}>
                <span
                  style={{
                    width: 7, height: 7, borderRadius: 999, display: 'inline-block',
                    background: SEGMENT_COLORS[hover.deal.primary_segment] ?? FALLBACK_COLOR,
                  }}
                />
                {label(hover.deal.primary_segment)}
                <span style={{ color: 'var(--text-faint)' }}>· {fmtMonth(hover.deal.month)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* legend: six largest segments in view */}
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
          {legend.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: 'var(--text-dim)' }}
              title={`${label(s.key)} — ${s.count} deal${s.count === 1 ? '' : 's'}, ${fmtUsd(s.usd)} disclosed`}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: 999, display: 'inline-block',
                  background: SEGMENT_COLORS[s.key] ?? FALLBACK_COLOR,
                }}
              />
              {label(s.key)}
              <span className="tnum" style={{ color: 'var(--text-faint)' }}>{s.count}</span>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
