import { useEffect } from 'react';
import {
  fmtUsd, fmtMonth, segmentLabel, countryName,
  SEGMENT_COLORS, STAGE_COLORS,
} from '../lib/format.js';

// Confidence hues drawn from the project palette family — read fine on both themes.
const CONFIDENCE = {
  high: { color: 'var(--accent)', label: 'High confidence', hint: 'Amount and terms corroborated by a primary or multiple sources.' },
  medium: { color: '#e5c454', label: 'Medium confidence', hint: 'Reported by a reliable secondary source; some fields unverified.' },
  low: { color: '#ef7d6a', label: 'Low confidence', hint: 'Extracted from a roundup or single mention; treat details as provisional.' },
};

function fmtDealDate(deal) {
  if (deal.date_precision !== 'day' || !deal.date) return fmtMonth(deal.month);
  const d = new Date(deal.date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return fmtMonth(deal.month);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function MetaRow({ label, children, title }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="eyebrow mb-0.5">{label}</div>
      <div className="text-[13px] leading-snug" style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="eyebrow mb-2">{children}</div>;
}

export default function DealDrawer({ deal, meta, onClose }) {
  useEffect(() => {
    if (!deal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [deal, onClose]);

  if (!deal) return null;

  const disclosed = !!deal.amount_disclosed && deal.amount_usd != null;
  const isEquity = !!deal.is_equity;
  const raw = deal.amount_raw;
  const nonUsdRaw = disclosed && raw && raw.currency && raw.currency !== 'USD';
  const conf = CONFIDENCE[deal.confidence] ?? {
    color: 'var(--text-faint)', label: 'Unrated', hint: 'No confidence rating recorded for this deal.',
  };
  const leads = deal.lead_investors ?? [];
  const leadSet = new Set(leads);
  const followers = (deal.investors ?? []).filter((i) => !leadSet.has(i));
  const orderedInvestors = [
    ...leads.map((name) => ({ name, lead: true })),
    ...followers.map((name) => ({ name, lead: false })),
  ];
  const segments = deal.segments?.length ? deal.segments : (deal.primary_segment ? [deal.primary_segment] : []);
  const description = deal.description ?? meta?.segments?.[deal.primary_segment]?.description ?? null;
  const stageMismatch = deal.stage_raw && deal.stage_raw !== deal.stage;

  return (
    <>
      <div
        className="backdrop"
        onClick={onClose}
        title="Close"
        aria-hidden="true"
      />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Deal detail: ${deal.company}`}
      >
        <div className="p-5 sm:p-6 flex flex-col gap-5">

          {/* ---- header ------------------------------------------------- */}
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="eyebrow flex items-center gap-1.5 mb-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: STAGE_COLORS[deal.stage] ?? 'var(--text-faint)' }}
                  aria-hidden="true"
                />
                <span title={stageMismatch ? `As reported: ${deal.stage_raw}` : deal.stage}>
                  {deal.stage}
                </span>
                <span style={{ color: 'var(--text-faint)' }} aria-hidden="true">·</span>
                <span title={deal.date_precision === 'day' ? `Announced ${deal.date}` : 'Month-level date precision'}>
                  {fmtDealDate(deal)}
                </span>
              </div>
              <h2
                className="display font-semibold leading-tight"
                style={{ fontSize: 26, color: 'var(--text)' }}
              >
                {deal.company}
              </h2>
              {description && (
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                  {description}
                </p>
              )}
            </div>
            <button
              className="btn shrink-0"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close deal detail"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Esc
            </button>
          </header>

          {/* ---- amount block ------------------------------------------- */}
          <div
            className="rounded-xl px-4 py-3.5"
            style={{ background: 'var(--panel-2)', border: '1px solid var(--border-soft)' }}
          >
            {disclosed ? (
              <>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span
                    className="tnum font-semibold"
                    style={{ fontSize: 28, color: 'var(--text)', letterSpacing: '-0.01em' }}
                    title={'$' + Math.round(deal.amount_usd).toLocaleString('en-US')}
                  >
                    {fmtUsd(deal.amount_usd)}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                    {isEquity ? 'disclosed equity round' : 'disclosed — non-equity'}
                  </span>
                </div>
                {nonUsdRaw && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-dim)' }}>
                    Raised as {raw.currency}{' '}
                    <span className="tnum">{Math.round(raw.value).toLocaleString('en-US')}</span>
                    {deal.fx_rate != null && (
                      <> · converted at <span className="tnum">{deal.fx_rate}</span>
                        {deal.fx_rate_date ? ` (${deal.fx_rate_date})` : ''}</>
                    )}
                  </p>
                )}
                {!isEquity && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                    {deal.stage === 'Debt' || deal.stage === 'Grant' ? deal.stage : 'Non-equity'} financing —
                    excluded from headline capital totals.
                  </p>
                )}
              </>
            ) : (
              <>
                <div
                  className="font-semibold"
                  style={{ fontSize: 22, color: 'var(--text-dim)', letterSpacing: '-0.01em' }}
                >
                  Undisclosed
                </div>
                <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                  No round size was disclosed in the sources below. This deal counts toward deal
                  volume but is never imputed into capital totals.
                </p>
              </>
            )}
            {deal.valuation_usd != null && (
              <div
                className="flex items-baseline justify-between gap-3 mt-3 pt-2.5"
                style={{ borderTop: '1px solid var(--border-soft)' }}
              >
                <span className="eyebrow">Valuation</span>
                <span
                  className="tnum text-[14px] font-medium"
                  style={{ color: 'var(--text)' }}
                  title={'$' + Math.round(deal.valuation_usd).toLocaleString('en-US')}
                >
                  {fmtUsd(deal.valuation_usd)}
                </span>
              </div>
            )}
          </div>

          {/* ---- meta grid ---------------------------------------------- */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <MetaRow label="Headquarters" title={countryName(deal.hq_country)}>
              {deal.hq_city ? `${deal.hq_city}, ` : ''}{countryName(deal.hq_country)}
            </MetaRow>
            <MetaRow label="Region">{deal.region ?? '—'}</MetaRow>
            <MetaRow
              label="Investors on record"
              title={deal.investors_partial ? 'Investor list may be incomplete' : undefined}
            >
              <span className="tnum">{deal.investor_count ?? '—'}</span>
              {deal.investors_partial && (
                <span className="text-[11px] ml-1" style={{ color: 'var(--text-faint)' }}>(partial)</span>
              )}
            </MetaRow>
            <MetaRow label="Confidence" title={conf.hint}>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  border: '1px solid var(--border)',
                  color: 'var(--text-dim)',
                  background: 'var(--panel-2)',
                  cursor: 'help',
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: conf.color }}
                  aria-hidden="true"
                />
                {conf.label}
              </span>
              {deal.verify && (
                <div
                  className="text-[11px] mt-1"
                  style={{ color: 'var(--text-faint)' }}
                  title="One or more fields could not be corroborated and are flagged for manual review."
                >
                  Flagged for verification
                </div>
              )}
            </MetaRow>
          </div>

          {/* ---- segments ----------------------------------------------- */}
          {segments.length > 0 && (
            <div>
              <SectionLabel>Segments</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {segments.map((s) => (
                  <span
                    key={s}
                    className="chip"
                    style={{ cursor: 'default' }}
                    title={
                      (meta?.segments?.[s]?.description ?? segmentLabel(meta, s)) +
                      (s === deal.primary_segment ? ' (primary segment)' : '')
                    }
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ background: SEGMENT_COLORS[s] ?? 'var(--text-faint)' }}
                      aria-hidden="true"
                    />
                    {segmentLabel(meta, s)}
                    {s === deal.primary_segment && segments.length > 1 && (
                      <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>primary</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ---- investors ---------------------------------------------- */}
          <div>
            <SectionLabel>Investors</SectionLabel>
            {orderedInvestors.length ? (
              <ul className="flex flex-col">
                {orderedInvestors.map(({ name, lead }, i) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
                    style={{
                      color: 'var(--text)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                    }}
                  >
                    <span className="min-w-0 truncate" title={name}>{name}</span>
                    {lead && (
                      <span
                        className="shrink-0 rounded-full px-2 py-px text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          color: 'var(--accent)',
                          border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
                          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                        }}
                        title="Led the round"
                      >
                        Lead
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                No investors disclosed in sources.
              </p>
            )}
          </div>

          {/* ---- sources ------------------------------------------------ */}
          <div>
            <SectionLabel>Sources</SectionLabel>
            {deal.sources?.length ? (
              <ul className="flex flex-col gap-1.5">
                {deal.sources.map((src, i) => {
                  const domain = domainOf(src.url);
                  return (
                    <li key={src.url ?? i}>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-2 rounded-lg px-2.5 py-2 -mx-1 transition-colors"
                        style={{ border: '1px solid transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.background = 'var(--panel-2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title={src.url}
                      >
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="mt-0.5 shrink-0"
                          aria-hidden="true"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        <span className="min-w-0">
                          <span className="block text-[13px] leading-snug" style={{ color: 'var(--text)' }}>
                            {src.name ?? domain ?? 'Source'}
                          </span>
                          <span className="block text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                            {domain ?? '—'}
                            {src.retrieved && <> · retrieved {src.retrieved}</>}
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                No sources on record for this deal.
              </p>
            )}
          </div>

          {/* ---- notes -------------------------------------------------- */}
          {deal.notes && (
            <p
              className="text-xs italic leading-relaxed pl-3"
              style={{ color: 'var(--text-dim)', borderLeft: '2px solid var(--border)' }}
            >
              {deal.notes}
            </p>
          )}

          {/* ---- footer ------------------------------------------------- */}
          <footer
            className="pt-3 mt-1"
            style={{ borderTop: '1px solid var(--border-soft)' }}
          >
            <span
              className="mono"
              style={{ fontSize: 10, color: 'var(--text-faint)' }}
              title="Internal deal identifier"
            >
              {deal.id}
            </span>
          </footer>
        </div>
      </aside>
    </>
  );
}
