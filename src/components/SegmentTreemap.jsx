import { useMemo, useState } from 'react';
import ChartCard from './ChartCard.jsx';
import { bySegment } from '../lib/analytics.js';
import { SEGMENT_COLORS, fmtUsd, segmentLabel } from '../lib/format.js';

// squarified treemap (Bruls et al.) — enough fidelity for ~11 cells
function squarify(items, x, y, w, h) {
  const total = items.reduce((s, d) => s + d.value, 0) || 1;
  const scaled = items.map((d) => ({ ...d, area: (d.value / total) * w * h }));
  const rects = [];
  let row = [];
  let rx = x, ry = y, rw = w, rh = h;

  const worst = (row, len) => {
    const s = row.reduce((a, b) => a + b.area, 0);
    const max = Math.max(...row.map((r) => r.area));
    const min = Math.min(...row.map((r) => r.area));
    return Math.max((len * len * max) / (s * s), (s * s) / (len * len * min));
  };
  const layoutRow = (row, len, horizontal) => {
    const s = row.reduce((a, b) => a + b.area, 0);
    const thick = s / len;
    let off = 0;
    for (const r of row) {
      const cell = r.area / thick;
      if (horizontal) rects.push({ ...r, x: rx, y: ry + off, w: thick, h: cell });
      else rects.push({ ...r, x: rx + off, y: ry, w: cell, h: thick });
      off += cell;
    }
    if (horizontal) { rx += thick; rw -= thick; } else { ry += thick; rh -= thick; }
  };

  const remaining = [...scaled];
  while (remaining.length) {
    const horizontal = rw >= rh;
    const len = horizontal ? rh : rw;
    const next = remaining[0];
    if (!row.length) { row.push(next); remaining.shift(); continue; }
    if (worst(row, len) >= worst([...row, next], len)) { row.push(next); remaining.shift(); }
    else { layoutRow(row, len, horizontal); row = []; }
  }
  if (row.length) layoutRow(row, rw >= rh ? rh : rw, rw >= rh);
  return rects;
}

export default function SegmentTreemap({ deals, filters, toggleValue, meta }) {
  const [metric, setMetric] = useState('usd');
  const W = 560, H = 300;
  const rows = bySegment(deals).filter((d) => (metric === 'usd' ? d.usd > 0 : d.count > 0));
  const items = rows.map((d) => ({ key: d.key, value: metric === 'usd' ? d.usd : d.count, count: d.count, usd: d.usd }));
  const rects = useMemo(() => squarify(items, 0, 0, W, H), [JSON.stringify(items)]);

  return (
    <ChartCard
      eyebrow="Market segment"
      title="Where the capital concentrates"
      subtitle="Area = disclosed capital (or deal count). Click to filter."
      exportName="segment-treemap"
      right={
        <div className="flex gap-1">
          <button className="chip" data-active={metric === 'usd'} onClick={() => setMetric('usd')}>$</button>
          <button className="chip" data-active={metric === 'count'} onClick={() => setMetric('count')}>#</button>
        </div>
      }
    >
      <div className="w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
          {rects.map((r) => {
            const dim = filters.segments.length && !filters.segments.includes(r.key);
            const big = r.w > 74 && r.h > 34;
            const label = segmentLabel(meta, r.key);
            return (
              <g key={r.key} className="cell-clickable" onClick={() => toggleValue('segments', r.key)}>
                <rect x={r.x + 1.5} y={r.y + 1.5} width={Math.max(0, r.w - 3)} height={Math.max(0, r.h - 3)}
                  rx={6} fill={SEGMENT_COLORS[r.key]} opacity={dim ? 0.22 : 0.9} />
                {big && (
                  <text x={r.x + 10} y={r.y + 20} fontSize={12} fontWeight="600" fill="#04140f" opacity={dim ? 0.4 : 0.92}>
                    {label.length > 20 ? label.slice(0, 19) + '…' : label}
                  </text>
                )}
                {big && (
                  <text x={r.x + 10} y={r.y + 37} fontSize={11} fill="#04140f" opacity={dim ? 0.35 : 0.7} className="tnum">
                    {metric === 'usd' ? fmtUsd(r.usd) : `${r.count} deals`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </ChartCard>
  );
}
