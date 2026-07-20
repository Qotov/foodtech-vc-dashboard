import ChartCard from './ChartCard.jsx';
import { topInvestors } from '../lib/analytics.js';
import { SEGMENT_COLORS, segmentLabel, fmtUsd } from '../lib/format.js';

export default function Investors({ deals, meta, filters, set }) {
  const investors = topInvestors(deals, 14);
  const maxDeals = Math.max(1, ...investors.map((i) => i.deals));

  return (
    <ChartCard
      eyebrow="Capital sources"
      title="Most active investors"
      subtitle="Ranked by disclosed participations. Bar split shows lead vs. follow. Click to filter."
      exportName="investors"
    >
      {investors.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--text-faint)' }}>No disclosed investors in this view.</p>
      ) : (
        <div className="space-y-1.5">
          {investors.map((inv) => (
            <button key={inv.investor} className="w-full flex items-center gap-2.5 cell-clickable text-left"
              onClick={() => set('search', inv.investor)} title={`Filter deals with ${inv.investor}`}>
              <div className="w-32 shrink-0 text-xs truncate" style={{ color: 'var(--text)' }}>{inv.investor}</div>
              <div className="flex-1 h-4 rounded-sm overflow-hidden flex" style={{ background: 'var(--panel-2)' }}>
                <div style={{ width: `${(inv.leads / maxDeals) * 100}%`, background: 'var(--accent)' }} />
                <div style={{ width: `${((inv.deals - inv.leads) / maxDeals) * 100}%`, background: 'var(--accent)', opacity: 0.4 }} />
              </div>
              <div className="w-6 shrink-0 text-right tnum text-xs" style={{ color: 'var(--text-dim)' }}>{inv.deals}</div>
              {inv.topSegment && (
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SEGMENT_COLORS[inv.topSegment] }}
                  title={`Concentrates in ${segmentLabel(meta, inv.topSegment)}`} />
              )}
            </button>
          ))}
          <div className="flex items-center gap-3 pt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'var(--accent)' }} />led</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'var(--accent)', opacity: 0.4 }} />participated</span>
            <span className="ml-auto">dot = focus segment</span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
