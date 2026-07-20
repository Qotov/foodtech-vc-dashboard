import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import ChartCard from './ChartCard.jsx';
import { byStage, stageDistribution } from '../lib/analytics.js';
import { STAGE_COLORS, fmtUsd } from '../lib/format.js';

function TipBox({ children }) {
  return (
    <div className="panel px-3 py-2 text-xs" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
      {children}
    </div>
  );
}

export default function StageBreakdown({ deals, filters, toggleValue }) {
  const [metric, setMetric] = useState('usd'); // 'usd' | 'count'
  const data = byStage(deals);
  const dist = stageDistribution(deals);

  const distMax = Math.max(1, ...dist.map((d) => d.max));

  return (
    <ChartCard
      eyebrow="Stage · primary clustering"
      title="Capital & deal count by stage"
      subtitle="Click a bar to filter everything. Debt & grants excluded from capital."
      exportName="stage-breakdown"
      right={
        <div className="flex gap-1">
          <button className="chip" data-active={metric === 'usd'} onClick={() => setMetric('usd')}>$</button>
          <button className="chip" data-active={metric === 'count'} onClick={() => setMetric('count')}>#</button>
        </div>
      }
    >
      <div style={{ height: 208 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis dataKey="key" tick={{ fontSize: 10, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={52} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => (metric === 'usd' ? fmtUsd(v) : v)} width={44} />
            <Tooltip
              cursor={{ fill: 'var(--panel-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <TipBox>
                    <div className="font-semibold mb-0.5">{d.key}</div>
                    <div style={{ color: 'var(--text-dim)' }}>{d.count} deals · {fmtUsd(d.usd)} disclosed</div>
                  </TipBox>
                );
              }}
            />
            <Bar dataKey={metric} radius={[4, 4, 0, 0]} onClick={(d) => toggleValue('stages', d.key)} className="cell-clickable">
              {data.map((d) => (
                <Cell key={d.key} fill={STAGE_COLORS[d.key]} opacity={filters.stages.length && !filters.stages.includes(d.key) ? 0.28 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <div className="eyebrow mb-2">Check-size distribution — min · IQR · median · max</div>
        <div className="space-y-1.5">
          {dist.map((d) => (
            <div key={d.stage} className="flex items-center gap-2 text-[11px]">
              <div className="w-16 shrink-0" style={{ color: 'var(--text-dim)' }}>{d.stage}</div>
              <div className="relative flex-1 h-4">
                {/* full range line */}
                <div className="absolute top-1/2 h-px" style={{ left: `${(d.min / distMax) * 100}%`, right: `${100 - (d.max / distMax) * 100}%`, background: 'var(--border)' }} />
                {/* IQR box */}
                <div className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-sm" style={{
                  left: `${(d.q1 / distMax) * 100}%`, width: `${((d.q3 - d.q1) / distMax) * 100}%`,
                  background: STAGE_COLORS[d.stage], opacity: 0.35,
                }} />
                {/* median tick */}
                <div className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3" style={{ left: `${(d.median / distMax) * 100}%`, background: STAGE_COLORS[d.stage] }} />
              </div>
              <div className="w-14 shrink-0 text-right tnum" style={{ color: 'var(--text-faint)' }}>{fmtUsd(d.median)}</div>
              <div className="w-6 shrink-0 text-right tnum" style={{ color: 'var(--text-faint)' }}>n{d.n}</div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
