import { useEffect, useMemo, useState } from 'react';
import dealsData from './data/deals.json';
import meta from './data/meta.json';
import { useDashboard } from './lib/useDashboard.js';
import { kpis } from './lib/analytics.js';
import { fmtMonth } from './lib/format.js';
import KpiStrip from './components/KpiStrip.jsx';
import FilterBar from './components/FilterBar.jsx';
import ActiveFilters from './components/ActiveFilters.jsx';
import InsightsPanel from './components/InsightsPanel.jsx';
import Beeswarm from './components/Beeswarm.jsx';
import StageBreakdown from './components/StageBreakdown.jsx';
import SegmentTreemap from './components/SegmentTreemap.jsx';
import MomentumChart from './components/MomentumChart.jsx';
import GeoMap from './components/GeoMap.jsx';
import Heatmap from './components/Heatmap.jsx';
import Investors from './components/Investors.jsx';
import NetworkGraph from './components/NetworkGraph.jsx';
import DealTable from './components/DealTable.jsx';
import DealDrawer from './components/DealDrawer.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Methodology from './components/Methodology.jsx';

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ft-theme') || 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('ft-theme', theme);
  }, [theme]);
  return [theme, setTheme];
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const [selectedDeal, setSelectedDeal] = useState(null);
  const dash = useDashboard(dealsData);
  const { filters, filtered, set, toggleValue, reset, activeCount } = dash;
  const k = useMemo(() => kpis(filtered), [filtered]);

  const months = useMemo(() => [...new Set(dealsData.map((d) => d.month))].sort(), []);
  const window_ = meta.ttm_window;

  return (
    <div className="min-h-screen">
      {/* Masthead */}
      <header className="sticky top-0 z-30 backdrop-blur" style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)', borderBottom: '1px solid var(--border-soft)' }}>
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#4cc9b0,#7aa2f7)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#04140f" strokeWidth="2.2"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
            </div>
            <div className="min-w-0">
              <h1 className="display text-[17px] sm:text-lg font-bold leading-tight truncate">Food Tech VC — The Trailing Twelve Months</h1>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-dim)' }}>
                {fmtMonth(window_.start.slice(0, 7))} – {fmtMonth(window_.end.slice(0, 7))} · {meta.deal_count} curated rounds · floor estimates, disclosed equity only
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="btn hidden sm:inline-flex" onClick={() => window.dispatchEvent(new Event('open-palette'))} title="Command palette">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <span className="hidden md:inline">Search</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
              {theme === 'dark'
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.2" y1="4.2" x2="5.6" y2="5.6" /><line x1="18.4" y1="18.4" x2="19.8" y2="19.8" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.2" y1="19.8" x2="5.6" y2="18.4" /><line x1="18.4" y1="5.6" x2="19.8" y2="4.2" /></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        <FilterBar filters={filters} set={set} toggleValue={toggleValue} reset={reset} activeCount={activeCount} months={months} meta={meta} />
        <ActiveFilters filters={filters} set={set} toggleValue={toggleValue} reset={reset} activeCount={activeCount} meta={meta} />

        <KpiStrip k={k} filteredCount={filtered.length} totalCount={dealsData.length} />

        <InsightsPanel deals={filtered} allDeals={dealsData} meta={meta} window={window_} toggleValue={toggleValue} />

        <Beeswarm deals={filtered} window={window_} onSelectDeal={setSelectedDeal} filters={filters} meta={meta} />

        <div className="grid lg:grid-cols-2 gap-5">
          <StageBreakdown deals={filtered} filters={filters} toggleValue={toggleValue} />
          <SegmentTreemap deals={filtered} filters={filters} toggleValue={toggleValue} meta={meta} />
        </div>

        <MomentumChart deals={filtered} window={window_} meta={meta} toggleValue={toggleValue} filters={filters} />

        <div className="grid lg:grid-cols-3 gap-5">
          <GeoMap deals={filtered} filters={filters} toggleValue={toggleValue} />
          <Heatmap deals={filtered} meta={meta} filters={filters} toggleValue={toggleValue} />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <Investors deals={filtered} meta={meta} filters={filters} set={set} />
          <NetworkGraph deals={filtered} meta={meta} set={set} />
        </div>

        <DealTable deals={filtered} meta={meta} onSelectDeal={setSelectedDeal} />

        <Methodology meta={meta} kpis={k} />

        <footer className="pt-2 pb-8 text-[11px] flex flex-wrap items-center justify-between gap-2" style={{ color: 'var(--text-faint)' }}>
          <span>Built {new Date(meta.built_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · headline capital counts disclosed equity only · filters live in the URL — copy to share a view</span>
          <span>Data: public sources (AgFunderNews, trade press) · curated & normalized · floor estimates</span>
        </footer>
      </main>

      <DealDrawer deal={selectedDeal} meta={meta} onClose={() => setSelectedDeal(null)} />
      <CommandPalette deals={filtered} meta={meta} filters={filters} set={set} toggleValue={toggleValue} reset={reset} onSelectDeal={setSelectedDeal} />
    </div>
  );
}
