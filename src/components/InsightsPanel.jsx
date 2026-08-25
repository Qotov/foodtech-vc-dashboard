// "Signals" — a responsive grid of computed insight cards. Clickable cards
// apply a filter via toggleValue(type, value); tone glyphs color the delta.

import { useMemo } from 'react';
import { computeInsights } from '../lib/insights.js';
import { segmentLabel } from '../lib/format.js';

const TONE_GLYPH = { up: '▲', down: '▼', flat: '◆', warn: '◆' };
const TONE_COLOR = {
  up: 'var(--accent)',
  down: '#e06c9f',
  flat: 'var(--text-faint)',
  warn: '#e5c454',
};

function Spark({ values }) {
  const pts = useMemo(() => {
    if (!values || values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const W = 120;
    const H = 40;
    const pad = 3;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - pad - ((v - min) / range) * (H - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [values]);
  if (!pts) return null;
  return (
    <svg
      viewBox="0 0 120 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ width: '100%', height: 40, display: 'block' }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.9"
      />
    </svg>
  );
}

export default function InsightsPanel({ deals, allDeals, meta, window: win, toggleValue }) {
  const insights = useMemo(
    () => computeInsights(deals ?? [], allDeals ?? [], win, meta ?? {}),
    [deals, allDeals, win, meta],
  );

  return (
    <section className="fade-enter">
      <div className="mb-3">
        <div className="eyebrow mb-1">What the data says</div>
        <h2
          className="display font-semibold leading-tight m-0"
          style={{ color: 'var(--text)', fontSize: 22 }}
        >
          Signals
        </h2>
      </div>

      {insights.length === 0 ? (
        <div
          className="panel p-6 text-center"
          style={{ color: 'var(--text-faint)', fontSize: 13 }}
        >
          Not enough deals in this view to surface signals — loosen a filter to see more.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {insights.map((ins) => {
            const clickable = Boolean(ins.action && toggleValue);
            const actionLabel = clickable
              ? ins.action.type === 'segments'
                ? segmentLabel(meta ?? {}, ins.action.value)
                : ins.action.value
              : null;
            const apply = clickable
              ? () => toggleValue(ins.action.type, ins.action.value)
              : undefined;
            const longHead = String(ins.headline).length > 14;
            return (
              <article
                key={ins.id}
                className="insight-card p-4 flex flex-col gap-2 min-w-0"
                data-clickable={clickable ? 'true' : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                title={clickable ? `Toggle filter: ${actionLabel}` : undefined}
                onClick={apply}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          apply();
                        }
                      }
                    : undefined
                }
              >
                <div className="eyebrow">{ins.eyebrow}</div>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span
                    className="tnum font-semibold leading-none truncate"
                    style={{ color: 'var(--text)', fontSize: longHead ? 17 : 22 }}
                    title={longHead ? String(ins.headline) : undefined}
                  >
                    {ins.headline}
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0"
                    style={{ color: TONE_COLOR[ins.tone] ?? TONE_COLOR.flat, fontSize: 10 }}
                  >
                    {TONE_GLYPH[ins.tone] ?? TONE_GLYPH.flat}
                  </span>
                </div>
                <p
                  className="m-0 leading-snug"
                  style={{ color: 'var(--text-dim)', fontSize: 12 }}
                >
                  {ins.body}
                </p>
                {ins.spark && ins.spark.length > 1 && (
                  <div className="mt-auto pt-1">
                    <Spark values={ins.spark} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
