import { fmtUsd } from '../lib/format.js';

function Kpi({ label, value, sub, accent, flag }) {
  return (
    <div className="panel px-4 py-3.5 flex flex-col justify-between min-w-0">
      <div className="eyebrow flex items-center gap-1.5">
        {label}
        {flag && (
          <span title={flag} className="inline-block" style={{ color: '#f6a24a' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        )}
      </div>
      <div className="tnum font-bold leading-none mt-2" style={{ fontSize: 26, color: accent ?? 'var(--text)' }}>
        {value}
      </div>
      {sub && <div className="text-[11px] mt-1.5" style={{ color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  );
}

export default function KpiStrip({ k, filteredCount, totalCount }) {
  const concentration = (k.top5Concentration * 100).toFixed(0);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Kpi
        label="Capital deployed"
        value={fmtUsd(k.totalUsd)}
        sub={`${k.disclosedCount} disclosed equity rounds`}
        accent="var(--accent)"
      />
      <Kpi label="Deals in view" value={k.dealCount} sub={filteredCount !== totalCount ? `of ${totalCount} total` : 'all sources'} />
      <Kpi label="Median check" value={fmtUsd(k.medianUsd)} sub={`mean ${fmtUsd(k.meanUsd)}`} />
      <Kpi
        label="Top-5 concentration"
        value={`${concentration}%`}
        sub="of disclosed equity capital"
        flag={k.top5Concentration > 0.4 ? 'High concentration: top 5 deals exceed 40% of capital' : null}
      />
      <Kpi label="Undisclosed" value={k.undisclosedCount} sub="excluded from sums" flag={k.undisclosedCount ? 'Amounts undisclosed — not imputed' : null} />
      <Kpi label="Active investors" value={k.activeInvestors} sub="disclosed participants" />
    </div>
  );
}
