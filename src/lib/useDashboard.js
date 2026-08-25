import { useEffect, useMemo, useReducer } from 'react';

export const initialFilters = {
  search: '',
  stages: [],        // canonical stage strings
  segments: [],      // segment keys (matches primary_segment OR any label — see mode)
  regions: [],
  countries: [],     // set via map clicks
  dateFrom: null,    // 'YYYY-MM'
  dateTo: null,
  sizeMin: 0,        // USD
  sizeMax: Infinity,
  disclosedOnly: false,
  includeDebtGrant: true, // when false, hide Debt+Grant rows entirely
  segmentMode: 'primary', // 'primary' | 'any'
};

function toggle(arr, v) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function reducer(state, action) {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value };
    case 'toggle':
      return { ...state, [action.key]: toggle(state[action.key], action.value) };
    case 'reset':
      return { ...initialFilters };
    default:
      return state;
  }
}

// --- URL hash sync: filters serialize into #… so any view is shareable ------
const LIST_KEYS = ['stages', 'segments', 'regions', 'countries'];

function filtersToHash(f) {
  const p = new URLSearchParams();
  for (const k of LIST_KEYS) if (f[k].length) p.set(k, f[k].join('~'));
  if (f.search) p.set('q', f.search);
  if (f.dateFrom) p.set('from', f.dateFrom);
  if (f.dateTo) p.set('to', f.dateTo);
  if (f.sizeMin > 0) p.set('min', String(f.sizeMin));
  if (f.sizeMax < Infinity) p.set('max', String(f.sizeMax));
  if (f.disclosedOnly) p.set('disc', '1');
  if (!f.includeDebtGrant) p.set('eq', '1');
  if (f.segmentMode === 'any') p.set('segmode', 'any');
  const s = p.toString();
  return s ? '#' + s : '';
}

function hashToFilters() {
  try {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return initialFilters;
    const p = new URLSearchParams(raw);
    const f = { ...initialFilters };
    for (const k of LIST_KEYS) if (p.get(k)) f[k] = p.get(k).split('~');
    if (p.get('q')) f.search = p.get('q');
    if (p.get('from')) f.dateFrom = p.get('from');
    if (p.get('to')) f.dateTo = p.get('to');
    if (p.get('min')) f.sizeMin = +p.get('min') || 0;
    if (p.get('max')) f.sizeMax = +p.get('max') || Infinity;
    if (p.get('disc')) f.disclosedOnly = true;
    if (p.get('eq')) f.includeDebtGrant = false;
    if (p.get('segmode') === 'any') f.segmentMode = 'any';
    return f;
  } catch {
    return initialFilters;
  }
}

export function useDashboard(deals) {
  const [filters, dispatch] = useReducer(reducer, undefined, hashToFilters);

  // reflect filters into the URL (replaceState: no history spam)
  useEffect(() => {
    const hash = filtersToHash(filters);
    const url = window.location.pathname + window.location.search + hash;
    window.history.replaceState(null, '', url);
  }, [filters]);

  const set = (key, value) => dispatch({ type: 'set', key, value });
  const toggleValue = (key, value) => dispatch({ type: 'toggle', key, value });
  const reset = () => dispatch({ type: 'reset' });

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return deals.filter((d) => {
      if (!filters.includeDebtGrant && (d.stage === 'Debt' || d.stage === 'Grant')) return false;
      if (filters.disclosedOnly && !d.amount_disclosed) return false;
      if (filters.stages.length && !filters.stages.includes(d.stage)) return false;
      if (filters.regions.length && !filters.regions.includes(d.region)) return false;
      if (filters.countries.length && !filters.countries.includes(d.hq_country)) return false;
      if (filters.segments.length) {
        const pool = filters.segmentMode === 'any' ? d.segments : [d.primary_segment];
        if (!filters.segments.some((s) => pool.includes(s))) return false;
      }
      if (filters.dateFrom && d.month < filters.dateFrom) return false;
      if (filters.dateTo && d.month > filters.dateTo) return false;
      if (d.amount_disclosed) {
        if (d.amount_usd < filters.sizeMin || d.amount_usd > filters.sizeMax) return false;
      } else if (filters.sizeMin > 0) {
        // an active size floor implies disclosed amounts only
        return false;
      }
      if (q) {
        const hay = [
          d.company, d.hq_city, d.hq_country, d.primary_segment,
          ...(d.investors ?? []), d.notes,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deals, filters]);

  const activeCount =
    filters.stages.length + filters.segments.length + filters.regions.length +
    filters.countries.length +
    (filters.search ? 1 : 0) + (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.sizeMin > 0 || filters.sizeMax < Infinity ? 1 : 0) +
    (filters.disclosedOnly ? 1 : 0) + (!filters.includeDebtGrant ? 1 : 0);

  return { filters, filtered, set, toggleValue, reset, activeCount };
}
