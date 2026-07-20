import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json';
import ChartCard from './ChartCard.jsx';
import { byCountry, byCity } from '../lib/analytics.js';
import { NUM_TO_ISO_A2, CITY_COORDS, cityKey } from '../lib/geo.js';
import { fmtUsd, countryName, REGION_COLORS } from '../lib/format.js';

const geographies = feature(worldTopo, worldTopo.objects.countries).features;

export default function GeoMap({ deals, filters, toggleValue }) {
  const [mode, setMode] = useState('usd'); // choropleth metric
  const [hover, setHover] = useState(null);

  const countryData = useMemo(() => {
    const m = new Map();
    for (const c of byCountry(deals)) m.set(c.key, c);
    return m;
  }, [deals]);

  const maxCountry = Math.max(1, ...[...countryData.values()].map((c) => (mode === 'usd' ? c.usd : c.count)));
  const color = scaleLinear().domain([0, maxCountry]).range(['#141b26', '#4cc9b0']);

  const cities = byCity(deals).filter((c) => CITY_COORDS[cityKey(c.city, c.country)]);
  const maxCity = Math.max(1, ...cities.map((c) => c.usd || c.count));
  const r = scaleSqrt().domain([0, maxCity]).range([2.5, 20]);

  return (
    <ChartCard
      eyebrow="Geography"
      title="Global footprint"
      subtitle="Country shading = activity; bubbles = city hubs sized by capital. Click a country to filter."
      exportName="geo-map"
      className="lg:col-span-2"
      right={
        <div className="flex gap-1">
          <button className="chip" data-active={mode === 'usd'} onClick={() => setMode('usd')}>$</button>
          <button className="chip" data-active={mode === 'count'} onClick={() => setMode('count')}>#</button>
        </div>
      }
    >
      <div className="relative">
        <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 165 }} style={{ width: '100%', height: 'auto' }} height={380}>
          <Geographies geography={geographies}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const iso = NUM_TO_ISO_A2[geo.id];
                const cd = iso ? countryData.get(iso) : null;
                const val = cd ? (mode === 'usd' ? cd.usd : cd.count) : 0;
                const active = filters.countries.includes(iso);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => iso && cd && toggleValue('countries', iso)}
                    onMouseEnter={() => cd && setHover({ name: countryName(iso), usd: cd.usd, count: cd.count })}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      default: { fill: cd ? color(val) : 'var(--panel-2)', stroke: 'var(--bg)', strokeWidth: 0.4, outline: 'none', cursor: cd ? 'pointer' : 'default' },
                      hover: { fill: cd ? '#5fb3e0' : 'var(--border)', stroke: 'var(--bg)', strokeWidth: 0.4, outline: 'none' },
                      pressed: { fill: '#5fb3e0', outline: 'none' },
                    }}
                    opacity={active ? 1 : filters.countries.length ? 0.55 : 1}
                  />
                );
              })
            }
          </Geographies>
          {cities.map((c) => {
            const coords = CITY_COORDS[cityKey(c.city, c.country)];
            return (
              <Marker key={cityKey(c.city, c.country)} coordinates={coords}
                onMouseEnter={() => setHover({ name: `${c.city}, ${c.country}`, usd: c.usd, count: c.count })}
                onMouseLeave={() => setHover(null)}>
                <circle r={r(c.usd || c.count)} fill="#f6a24a" fillOpacity={0.5} stroke="#f6a24a" strokeWidth={0.8} style={{ cursor: 'pointer' }} />
              </Marker>
            );
          })}
        </ComposableMap>
        {hover && (
          <div className="absolute top-2 left-2 panel px-3 py-2 text-xs pointer-events-none" style={{ borderColor: 'var(--border)' }}>
            <div className="font-semibold">{hover.name}</div>
            <div style={{ color: 'var(--text-dim)' }}>{fmtUsd(hover.usd)} · {hover.count} deals</div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: '#4cc9b0' }} /> more capital</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#f6a24a', opacity: 0.6 }} /> city hub</span>
      </div>
    </ChartCard>
  );
}
