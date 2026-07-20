import { useRef } from 'react';
import { chartToPng } from '../lib/export.js';

export default function ChartCard({ eyebrow, title, subtitle, children, right, exportName, className = '' }) {
  const bodyRef = useRef(null);
  const onPng = () => {
    const bg = getComputedStyle(document.body).getPropertyValue('--panel').trim() || '#0f1218';
    chartToPng(bodyRef.current, `${exportName ?? 'chart'}.png`, bg);
  };
  return (
    <section className={`panel p-4 sm:p-5 flex flex-col ${className}`}>
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h3 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          {exportName && (
            <button className="btn" onClick={onPng} title="Download PNG">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              PNG
            </button>
          )}
        </div>
      </header>
      <div ref={bodyRef} className="flex-1 min-h-0">{children}</div>
    </section>
  );
}
