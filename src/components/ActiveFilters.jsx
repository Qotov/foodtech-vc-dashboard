import { fmtMonth, segmentLabel, fmtUsd } from '../lib/format.js';

export default function ActiveFilters({ filters, set, toggleValue, reset, activeCount, meta }) {
  if (activeCount === 0) return null;
  const pills = [];
  const add = (label, onRemove) => pills.push({ label, onRemove });

  filters.stages.forEach((s) => add(`Stage: ${s}`, () => toggleValue('stages', s)));
  filters.segments.forEach((s) => add(`Segment: ${segmentLabel(meta, s)}`, () => toggleValue('segments', s)));
  filters.regions.forEach((r) => add(`Region: ${r}`, () => toggleValue('regions', r)));
  filters.countries.forEach((c) => add(`Country: ${c}`, () => toggleValue('countries', c)));
  if (filters.search) add(`“${filters.search}”`, () => set('search', ''));
  if (filters.dateFrom || filters.dateTo) add(`${filters.dateFrom ? fmtMonth(filters.dateFrom) : '…'} – ${filters.dateTo ? fmtMonth(filters.dateTo) : '…'}`, () => { set('dateFrom', null); set('dateTo', null); });
  if (filters.sizeMin > 0 || filters.sizeMax < Infinity) add(`${fmtUsd(filters.sizeMin)}–${filters.sizeMax === Infinity ? '∞' : fmtUsd(filters.sizeMax)}`, () => { set('sizeMin', 0); set('sizeMax', Infinity); });
  if (filters.disclosedOnly) add('Disclosed only', () => set('disclosedOnly', false));
  if (!filters.includeDebtGrant) add('Equity only', () => set('includeDebtGrant', true));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="eyebrow mr-1">Filtering</span>
      {pills.map((p, i) => (
        <button key={i} className="chip" data-active="true" onClick={p.onRemove}>
          {p.label}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      ))}
      <button className="text-xs underline ml-1" style={{ color: 'var(--text-dim)' }} onClick={reset}>clear all</button>
    </div>
  );
}
