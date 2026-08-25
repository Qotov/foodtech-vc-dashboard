import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fmtUsd, segmentLabel,
  SEGMENT_COLORS, STAGE_COLORS, REGION_COLORS,
} from '../lib/format.js';
import { downloadCsv } from '../lib/export.js';

const MAX_RESULTS = 12;
const MAX_DEALS = 6;

function toggleTheme() {
  const el = document.documentElement;
  const toLight = !el.classList.contains('light');
  el.classList.toggle('light', toLight);
  el.classList.toggle('dark', !toLight);
  try { localStorage.setItem('ft-theme', toLight ? 'light' : 'dark'); } catch { /* private mode */ }
}

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const Dot = ({ color }) => (
  <span
    aria-hidden="true"
    style={{
      width: 8, height: 8, borderRadius: 999, flexShrink: 0,
      background: color ?? 'var(--text-faint)',
    }}
  />
);

export default function CommandPalette({ deals, meta, filters, set, toggleValue, reset, onSelectDeal }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const openRef = useRef(open);
  openRef.current = open;
  const listRef = useRef(null);

  // Global shortcuts — registered once, cleaned up on unmount. setOpen is
  // stable and openRef avoids stale closures, so no re-registration churn.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && openRef.current) {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-palette', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-palette', onOpenEvent);
    };
  }, []);

  // Fresh state each time the palette opens.
  useEffect(() => {
    if (open) { setQuery(''); setActiveIndex(0); }
  }, [open]);

  // Lock body scroll while open — no scroll bleed behind the backdrop.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const groups = useMemo(() => {
    if (!open) return [];
    const q = query.trim().toLowerCase();
    const out = [];
    let budget = MAX_RESULTS;
    const push = (label, items) => {
      if (!items.length || budget <= 0) return;
      const take = items.slice(0, budget);
      budget -= take.length;
      out.push({ label, items: take });
    };

    // 1. Deals — company / investor substring match (query required).
    if (q) {
      const hits = [];
      for (const d of deals) {
        if (hits.length >= MAX_DEALS) break;
        const inCompany = d.company && d.company.toLowerCase().includes(q);
        const viaInvestor = inCompany
          ? null
          : (d.investors ?? []).find((inv) => inv.toLowerCase().includes(q));
        if (!inCompany && !viaInvestor) continue;
        hits.push({
          id: `deal:${d.id}`,
          kind: 'deal',
          dot: SEGMENT_COLORS[d.primary_segment],
          label: d.company,
          hint: viaInvestor ? `via ${viaInvestor}` : segmentLabel(meta, d.primary_segment),
          right: `${d.amount_disclosed ? fmtUsd(d.amount_usd) : 'undisclosed'} · ${d.stage}`,
          title: `Open deal — ${d.company}`,
          run: () => onSelectDeal(d),
        });
      }
      push('Deals', hits);
    }

    // 2. Filter actions — stages, segments, regions matching the query.
    if (q) {
      const actions = [];
      for (const s of meta.stages ?? []) {
        if (!s.toLowerCase().includes(q)) continue;
        const active = filters.stages.includes(s);
        actions.push({
          id: `stage:${s}`, kind: 'filter', dot: STAGE_COLORS[s],
          label: `Filter stage: ${s}`, hint: active ? 'active — click to clear' : null,
          active, title: `${active ? 'Remove' : 'Apply'} stage filter ${s}`,
          run: () => toggleValue('stages', s),
        });
      }
      for (const key of Object.keys(meta.segments ?? {})) {
        const label = segmentLabel(meta, key);
        if (!label.toLowerCase().includes(q) && !key.toLowerCase().includes(q)) continue;
        const active = filters.segments.includes(key);
        actions.push({
          id: `segment:${key}`, kind: 'filter', dot: SEGMENT_COLORS[key],
          label: `Filter segment: ${label}`, hint: active ? 'active — click to clear' : null,
          active, title: `${active ? 'Remove' : 'Apply'} segment filter ${label}`,
          run: () => toggleValue('segments', key),
        });
      }
      for (const r of meta.regions ?? []) {
        if (!r.toLowerCase().includes(q)) continue;
        const active = filters.regions.includes(r);
        actions.push({
          id: `region:${r}`, kind: 'filter', dot: REGION_COLORS[r],
          label: `Filter region: ${r}`, hint: active ? 'active — click to clear' : null,
          active, title: `${active ? 'Remove' : 'Apply'} region filter ${r}`,
          run: () => toggleValue('regions', r),
        });
      }
      push('Filters', actions);
    }

    // 3. Commands — always listed; narrowed by query when present.
    const commands = [
      {
        id: 'cmd:reset', label: 'Reset all filters',
        hint: null, title: 'Clear every active filter',
        run: () => reset(),
      },
      {
        id: 'cmd:disclosed', label: 'Toggle disclosed only',
        hint: filters.disclosedOnly ? 'on' : 'off',
        title: 'Show only rounds with a disclosed amount',
        run: () => set('disclosedOnly', !filters.disclosedOnly),
      },
      {
        id: 'cmd:equity', label: 'Toggle equity only',
        hint: !filters.includeDebtGrant ? 'on' : 'off',
        title: 'Hide debt and grant rounds',
        run: () => set('includeDebtGrant', !filters.includeDebtGrant),
      },
      {
        id: 'cmd:csv', label: 'Export CSV of current view',
        hint: `${deals.length} deal${deals.length === 1 ? '' : 's'}`,
        title: 'Download the filtered deals as CSV',
        run: () => downloadCsv(deals),
      },
      {
        id: 'cmd:theme', label: 'Toggle theme',
        hint: 'dark / light', title: 'Switch between dark and light themes',
        run: () => toggleTheme(),
      },
    ]
      .filter((c) => !q || c.label.toLowerCase().includes(q))
      .map((c) => ({ ...c, kind: 'command' }));
    push('Commands', commands);

    return out;
  }, [open, query, deals, meta, filters, set, toggleValue, reset, onSelectDeal]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const effIndex = flat.length ? Math.min(activeIndex, flat.length - 1) : -1;

  // Keep the active row in view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector('[data-active-item="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, effIndex, flat]);

  if (!open) return null;

  const runItem = (item) => {
    if (!item) return;
    item.run();
    setOpen(false);
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flat.length) setActiveIndex((effIndex + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setActiveIndex((effIndex - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(flat[effIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Home' && flat.length) {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End' && flat.length) {
      e.preventDefault();
      setActiveIndex(flat.length - 1);
    }
  };

  let flatIdx = -1;

  return (
    <>
      <div className="backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        {/* search row */}
        <div
          className="flex items-center gap-2.5 px-4"
          style={{ borderBottom: '1px solid var(--border-soft)', height: 48 }}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" aria-hidden="true"
            style={{ color: 'var(--text-faint)', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={onInputKeyDown}
            placeholder="Search deals, investors, filters, commands…"
            aria-label="Search deals, investors, filters, and commands"
            spellCheck={false}
            autoComplete="off"
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none',
              outline: 'none', fontSize: 14, color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          />
          <kbd title="Close">esc</kbd>
        </div>

        {/* results */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Results"
          style={{ maxHeight: 'min(52vh, 400px)', overflowY: 'auto', overscrollBehavior: 'contain', padding: '6px 0' }}
        >
          {flat.length === 0 && (
            <div
              className="px-4 py-6 text-center"
              style={{ fontSize: 13, color: 'var(--text-faint)' }}
            >
              Nothing matches “{query.trim()}”. Try a company, investor, stage, or command.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.label}>
              <div className="eyebrow px-4 pt-2 pb-1">{g.label}</div>
              {g.items.map((item) => {
                flatIdx += 1;
                const idx = flatIdx;
                const isActive = idx === effIndex;
                return (
                  <div
                    key={item.id}
                    role="option"
                    aria-selected={isActive}
                    data-active-item={isActive || undefined}
                    title={item.title}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => runItem(item)}
                    className="flex items-center gap-2.5 px-4"
                    style={{
                      height: 38, cursor: 'pointer', fontSize: 13,
                      background: isActive ? 'var(--panel-2)' : 'transparent',
                      boxShadow: isActive ? 'inset 2px 0 0 var(--accent)' : 'none',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {item.kind === 'command'
                      ? <span style={{ color: 'var(--text-faint)', display: 'inline-flex', flexShrink: 0 }}><Chevron /></span>
                      : <Dot color={item.dot} />}
                    <span
                      className="truncate"
                      style={{ color: 'var(--text)', fontWeight: item.kind === 'deal' ? 500 : 400 }}
                    >
                      {item.label}
                    </span>
                    {item.active && (
                      <span
                        className="chip"
                        data-active="true"
                        style={{ fontSize: 10, padding: '1px 7px', cursor: 'inherit', flexShrink: 0 }}
                      >
                        active
                      </span>
                    )}
                    {item.hint && !item.active && (
                      <span className="truncate" style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>
                        {item.hint}
                      </span>
                    )}
                    <span className="flex-1" />
                    {item.right && (
                      <span
                        className="tnum"
                        style={{ color: 'var(--text-dim)', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        {item.right}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* footer */}
        <div
          className="flex items-center justify-between px-4"
          style={{
            height: 34, borderTop: '1px solid var(--border-soft)',
            background: 'var(--panel-2)', fontSize: 11, color: 'var(--text-faint)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <kbd>↑</kbd><kbd>↓</kbd> navigate
            <span style={{ margin: '0 4px' }}>·</span>
            <kbd>↵</kbd> select
            <span style={{ margin: '0 4px' }}>·</span>
            <kbd>esc</kbd> close
          </div>
          <div className="flex items-center gap-1.5">
            <kbd>⌘K</kbd> toggle
          </div>
        </div>
      </div>
    </>
  );
}
