import { useState } from 'react';
import ChartCard from './ChartCard.jsx';
import { crosstab } from '../lib/analytics.js';
import { STAGE_ORDER, segmentLabel, fmtUsd } from '../lib/format.js';

const EQUITY_STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Growth'];

export default function Heatmap({ deals, meta, filters, toggleValue }) {
  const [view, setView] = useState('seg-stage'); // 'seg-stage' | 'geo-seg'
  const segKeys = Object.keys(meta.segments);
  const regions = meta.regions.filter((r) => r !== 'Other');

  const config = view === 'seg-stage'
    ? { rows: segKeys, cols: EQUITY_STAGES, rowLabel: (r) => segmentLabel(meta, r), fn: { row: (d) => d.primary_segment, col: (d) => d.stage } }
    : { rows: regions, cols: segKeys, rowLabel: (r) => r, fn: { row: (d) => d.region, col: (d) => d.primary_segment } };

  const matrix = crosstab(deals, config.fn, config.cols, config.rows).filter((m) => m.cells.some((c) => c.count > 0));
  const max = Math.max(1, ...matrix.flatMap((m) => m.cells.map((c) => c.count)));

  const colLabel = (c) => (view === 'seg-stage' ? c : segmentLabel(meta, c).split(' ')[0]);

  return (
    <ChartCard
      eyebrow="Cross-tab"
      title={view === 'seg-stage' ? 'Segment × stage' : 'Region × segment'}
      subtitle="Cell = deal count; shade = intensity. Hover for capital."
      exportName={`heatmap-${view}`}
      right={
        <div className="flex gap-1">
          <button className="chip" data-active={view === 'seg-stage'} onClick={() => setView('seg-stage')}>Seg×Stage</button>
          <button className="chip" data-active={view === 'geo-seg'} onClick={() => setView('geo-seg')}>Geo×Seg</button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ minWidth: 460 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10" style={{ background: 'var(--panel)' }}></th>
              {config.cols.map((c) => (
                <th key={c} className="px-1 pb-1.5 text-[10px] font-semibold align-bottom" style={{ color: 'var(--text-faint)', writingMode: view === 'geo-seg' ? 'vertical-rl' : 'horizontal-tb', textAlign: 'center', height: view === 'geo-seg' ? 74 : 'auto' }}>
                  {colLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((m) => (
              <tr key={m.row}>
                <td className="pr-2 py-0.5 text-[11px] whitespace-nowrap sticky left-0 z-10" style={{ color: 'var(--text-dim)', background: 'var(--panel)' }}>{config.rowLabel(m.row)}</td>
                {m.cells.map((c) => {
                  const t = c.count / max;
                  return (
                    <td key={c.col} className="p-0.5">
                      <div
                        className="rounded flex items-center justify-center tnum cell-clickable"
                        title={`${config.rowLabel(m.row)} · ${colLabel(c.col)} — ${c.count} deals · ${fmtUsd(c.usd)}`}
                        onClick={() => { if (c.count) { toggleValue(view === 'seg-stage' ? 'segments' : 'regions', m.row); toggleValue(view === 'seg-stage' ? 'stages' : 'segments', c.col); } }}
                        style={{
                          height: 30, minWidth: 30, fontSize: 11, fontWeight: 600,
                          background: c.count ? `color-mix(in srgb, var(--accent) ${18 + t * 72}%, transparent)` : 'var(--panel-2)',
                          color: t > 0.5 ? '#04140f' : 'var(--text-dim)',
                        }}
                      >
                        {c.count || ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
