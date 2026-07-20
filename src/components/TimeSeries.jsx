import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard.jsx';
import { monthlySeries } from '../lib/analytics.js';
import { fmtUsd, fmtMonth } from '../lib/format.js';

export default function TimeSeries({ deals, window, set, filters }) {
  const data = monthlySeries(deals, window);

  const onClick = (e) => {
    const m = e?.activePayload?.[0]?.payload?.month;
    if (!m) return;
    // clicking a month sets both bounds to that month (toggle off if already isolated)
    if (filters.dateFrom === m && filters.dateTo === m) { set('dateFrom', null); set('dateTo', null); }
    else { set('dateFrom', m); set('dateTo', m); }
  };

  return (
    <ChartCard
      eyebrow="Momentum"
      title="Monthly capital & deal flow"
      subtitle="Bars = disclosed capital, line = deal count. Click a month to filter."
      exportName="time-series"
    >
      <div style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} onClick={onClick} className="cell-clickable">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={44} />
            <YAxis yAxisId="l" tick={{ fontSize: 10, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtUsd(v)} width={46} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} width={26} />
            <Tooltip
              cursor={{ fill: 'var(--panel-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="panel px-3 py-2 text-xs" style={{ borderColor: 'var(--border)' }}>
                    <div className="font-semibold mb-0.5">{fmtMonth(d.month)}</div>
                    <div style={{ color: 'var(--text-dim)' }}>{fmtUsd(d.usd)} · {d.count} deals</div>
                  </div>
                );
              }}
            />
            <Bar yAxisId="l" dataKey="usd" fill="var(--accent)" radius={[3, 3, 0, 0]} opacity={0.85} maxBarSize={26} />
            <Line yAxisId="r" type="monotone" dataKey="count" stroke="#f6a24a" strokeWidth={2} dot={{ r: 2.5, fill: '#f6a24a' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
