import { useMemo, useState } from 'react';
import { downloadCsv } from '../lib/export.js';
import { SEGMENT_COLORS, STAGE_COLORS, fmtUsd, segmentLabel, countryName } from '../lib/format.js';

const COLS = [
  { key: 'company', label: 'Company', align: 'left' },
  { key: 'date', label: 'Date', align: 'left' },
  { key: 'stage', label: 'Stage', align: 'left' },
  { key: 'amount_usd', label: 'Amount', align: 'right' },
  { key: 'primary_segment', label: 'Segment', align: 'left' },
  { key: 'hq_country', label: 'HQ', align: 'left' },
  { key: 'lead_investors', label: 'Lead', align: 'left' },
  { key: 'confidence', label: 'Conf.', align: 'left' },
];

const CONF_COLOR = { high: '#4cc9b0', medium: '#e5c454', low: '#ef7d6a' };

export default function DealTable({ deals, meta, onSelectDeal }) {
  const [sort, setSort] = useState({ key: 'amount_usd', dir: -1 });

  const sorted = useMemo(() => {
    const arr = [...deals];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let av = a[key], bv = b[key];
      if (key === 'amount_usd') { av = av ?? -1; bv = bv ?? -1; }
      if (Array.isArray(av)) av = av[0] ?? '';
      if (Array.isArray(bv)) bv = bv[0] ?? '';
      if (av == null) av = '';
      if (bv == null) bv = '';
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return arr;
  }, [deals, sort]);

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'amount_usd' || key === 'date' ? -1 : 1 }));

  return (
    <section className="panel p-4 sm:p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="eyebrow mb-1">Ledger</div>
          <h3 className="display text-[17px] font-semibold">The ledger <span className="tnum font-normal font-sans text-[13px]" style={{ color: 'var(--text-dim)' }}>· {deals.length} rounds</span></h3>
        </div>
        <button className="btn" onClick={() => downloadCsv(sorted)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Export CSV
        </button>
      </header>
      <div className="overflow-auto" style={{ maxHeight: 460 }}>
        <table className="deals">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} onClick={() => onSort(c.key)} style={{ textAlign: c.align }}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort.key === c.key && <span style={{ color: 'var(--accent)' }}>{sort.dir === 1 ? '▲' : '▼'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.id} onClick={() => onSelectDeal?.(d)} style={{ cursor: onSelectDeal ? 'pointer' : 'default' }} title="Open deal detail">
                <td className="font-medium">
                  {d.company}
                  {d.hq_city && <span className="block text-[11px]" style={{ color: 'var(--text-faint)' }}>{d.hq_city}</span>}
                </td>
                <td className="tnum whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{d.date}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLORS[d.stage] }} />
                    {d.stage}
                  </span>
                </td>
                <td className="text-right tnum whitespace-nowrap">
                  {d.amount_disclosed
                    ? <span>{fmtUsd(d.amount_usd)}{d.amount_raw?.currency !== 'USD' && <span className="text-[10px] ml-1" style={{ color: 'var(--text-faint)' }}>{d.amount_raw.currency}</span>}</span>
                    : <span style={{ color: 'var(--text-faint)' }} title="Amount undisclosed — excluded from sums">undisc.</span>}
                </td>
                <td>
                  {d.primary_segment && (
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span className="w-2 h-2 rounded-sm" style={{ background: SEGMENT_COLORS[d.primary_segment] }} />
                      {segmentLabel(meta, d.primary_segment)}
                    </span>
                  )}
                </td>
                <td title={countryName(d.hq_country)} className="whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>{d.hq_country ?? '—'}</td>
                <td style={{ color: 'var(--text-dim)' }} className="max-w-[140px] truncate">{d.lead_investors?.join(', ') || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                <td>
                  <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: CONF_COLOR[d.confidence] }} title={d.notes ?? d.confidence}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: CONF_COLOR[d.confidence] }} />
                    {d.confidence}{d.verify ? '*' : ''}
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={COLS.length} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>No deals match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
        <span className="mono">*</span> flagged for individual verification (extracted from weekly roundups). Sums exclude undisclosed amounts.
      </p>
    </section>
  );
}
