import { useMemo, useReducer } from 'react';

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

export function useDashboard(deals) {
  const [filters, dispatch] = useReducer(reducer, initialFilters);

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
