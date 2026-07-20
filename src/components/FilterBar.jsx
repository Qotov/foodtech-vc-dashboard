import { useState } from 'react';
import { STAGE_ORDER, fmtMonth, segmentLabel } from '../lib/format.js';

const SIZE_PRESETS = [
  { label: 'Any size', min: 0, max: Infinity },
  { label: '< $5M', min: 0, max: 5e6 },
  { label: '$5–20M', min: 5e6, max: 20e6 },
  { label: '$20–50M', min: 20e6, max: 50e6 },
  { label: '$50M+', min: 50e6, max: Infinity },
];

function Toggle({ on, onClick, children, title }) {
  return (
    <button className="chip" data-active={on} onClick={onClick} title={title}>{children}</button>
  );
}

export default function FilterBar({ filters, set, toggleValue, reset, activeCount, months, meta }) {
  const [open, setOpen] = useState(false);
  const segKeys = Object.keys(meta.segments);
  const regions = meta.regions;
  const stages = STAGE_ORDER.filter((s) => s !== 'Unknown');

  const sizeIdx = SIZE_PRESETS.findIndex((p) => p.min === filters.sizeMin && p.max === filters.sizeMax);

  return (
    <div className="panel p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Search company, investor, city…"
            className="w-full bg-transparent border rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>

        <select
          value={filters.dateFrom ?? ''}
          onChange={(e) => set('dateFrom', e.target.value || null)}
          className="bg-transparent border rounded-lg px-2.5 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          title="From month"
        >
          <option value="">From…</option>
          {months.map((m) => <option key={m} value={m} style={{ background: 'var(--panel)' }}>{fmtMonth(m)}</option>)}
        </select>
        <select
          value={filters.dateTo ?? ''}
          onChange={(e) => set('dateTo', e.target.value || null)}
          className="bg-transparent border rounded-lg px-2.5 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          title="To month"
        >
          <option value="">To…</option>
          {months.map((m) => <option key={m} value={m} style={{ background: 'var(--panel)' }}>{fmtMonth(m)}</option>)}
        </select>

        <select
          value={sizeIdx < 0 ? 0 : sizeIdx}
          onChange={(e) => { const p = SIZE_PRESETS[+e.target.value]; set('sizeMin', p.min); set('sizeMax', p.max); }}
          className="bg-transparent border rounded-lg px-2.5 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          title="Deal size"
        >
          {SIZE_PRESETS.map((p, i) => <option key={p.label} value={i} style={{ background: 'var(--panel)' }}>{p.label}</option>)}
        </select>

        <Toggle on={filters.disclosedOnly} onClick={() => set('disclosedOnly', !filters.disclosedOnly)} title="Show only rounds with a disclosed amount">
          Disclosed only
        </Toggle>
        <Toggle on={!filters.includeDebtGrant} onClick={() => set('includeDebtGrant', !filters.includeDebtGrant)} title="Hide debt and grant rounds">
          Equity only
        </Toggle>

        <button className="btn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'More'} filters
          {activeCount > 0 && <span className="tnum ml-1 px-1.5 rounded-full text-[10px]" style={{ background: 'var(--accent)', color: '#04140f' }}>{activeCount}</span>}
        </button>
        {activeCount > 0 && <button className="btn" onClick={reset} title="Clear all filters">Reset</button>}
      </div>

      {open && (
        <div className="mt-3.5 pt-3.5 space-y-3 fade-enter" style={{ borderTop: '1px solid var(--border-soft)' }}>
          <FilterRow label="Stage">
            {stages.map((s) => (
              <button key={s} className="chip" data-active={filters.stages.includes(s)} onClick={() => toggleValue('stages', s)}>{s}</button>
            ))}
          </FilterRow>
          <FilterRow label="Region">
            {regions.map((r) => (
              <button key={r} className="chip" data-active={filters.regions.includes(r)} onClick={() => toggleValue('regions', r)}>{r}</button>
            ))}
          </FilterRow>
          <FilterRow label={
            <span className="flex items-center gap-2">Segment
              <button className="chip !py-0.5 !text-[10px]" data-active={filters.segmentMode === 'any'}
                onClick={() => set('segmentMode', filters.segmentMode === 'any' ? 'primary' : 'any')}
                title="Match primary tag only, or any of a deal's segment labels">
                {filters.segmentMode === 'any' ? 'any label' : 'primary only'}
              </button>
            </span>
          }>
            {segKeys.map((s) => (
              <button key={s} className="chip" data-active={filters.segments.includes(s)} onClick={() => toggleValue('segments', s)}>{segmentLabel(meta, s)}</button>
            ))}
          </FilterRow>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="eyebrow shrink-0 w-20 pt-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
