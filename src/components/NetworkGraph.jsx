import { useMemo, useState, useCallback } from 'react';
import ChartCard from './ChartCard.jsx';
import { SEGMENT_COLORS, segmentLabel } from '../lib/format.js';

const W = 560;
const H = 380;
const CX = W / 2;
const CY = H / 2;
const MAX_NODES = 60; // keep the sim readable; top investors by activity
const LABEL_COUNT = 12;

// deterministic seeded LCG so re-renders produce identical layouts
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildGraph(deals) {
  // qualifying deals: ≥2 named investors (co-investment is observable)
  const coDeals = deals.filter((d) => Array.isArray(d.investors) && d.investors.length >= 2);
  if (!coDeals.length) return { nodes: [], edges: [] };

  const inv = new Map(); // name -> { dealCount, segments: Map }
  const edgeMap = new Map(); // "a|b" (sorted) -> weight

  for (const d of coDeals) {
    const names = [...new Set(d.investors.filter(Boolean))];
    for (const n of names) {
      if (!inv.has(n)) inv.set(n, { name: n, dealCount: 0, segments: new Map() });
      const g = inv.get(n);
      g.dealCount += 1;
      if (d.primary_segment) {
        g.segments.set(d.primary_segment, (g.segments.get(d.primary_segment) ?? 0) + 1);
      }
    }
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const [a, b] = names[i] < names[j] ? [names[i], names[j]] : [names[j], names[i]];
        const k = a + '|' + b;
        edgeMap.set(k, (edgeMap.get(k) ?? 0) + 1);
      }
    }
  }

  // cap node count for readability: keep the most active investors
  let nodes = [...inv.values()].sort((a, b) => b.dealCount - a.dealCount || (a.name < b.name ? -1 : 1));
  const kept = new Set(nodes.slice(0, MAX_NODES).map((n) => n.name));
  nodes = nodes.filter((n) => kept.has(n.name));

  const edges = [];
  for (const [k, weight] of edgeMap) {
    const [a, b] = k.split('|');
    if (kept.has(a) && kept.has(b)) edges.push({ a, b, weight });
  }
  // drop nodes that lost every partner to the cap
  const connected = new Set(edges.flatMap((e) => [e.a, e.b]));
  nodes = nodes.filter((n) => connected.has(n.name));

  const degree = new Map();
  for (const e of edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }

  return {
    nodes: nodes.map((n) => {
      const modal = [...n.segments.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      return {
        name: n.name,
        dealCount: n.dealCount,
        segment: modal,
        r: 4 + 3 * Math.sqrt(n.dealCount),
        degree: degree.get(n.name) ?? 0,
      };
    }),
    edges,
  };
}

function runLayout(nodes, edges) {
  const n = nodes.length;
  if (!n) return [];
  const seed = hashString(nodes.map((d) => d.name).join('~') + ':' + edges.length);
  const rng = makeRng(seed || 1);

  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const idx = new Map(nodes.map((d, i) => [d.name, i]));

  // seeded start: ring + jitter around center
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5;
    const rad = 60 + rng() * 110;
    x[i] = CX + Math.cos(a) * rad;
    y[i] = CY + Math.sin(a) * rad * (H / W);
  }

  const E = edges.map((e) => ({ i: idx.get(e.a), j: idx.get(e.b), w: e.weight }));
  const REPULSE = 22000;
  const SPRING = 0.035;
  const REST = 72;
  const GRAVITY = 0.028;
  const ITER = 250;

  const dx = new Float64Array(n);
  const dy = new Float64Array(n);

  for (let it = 0; it < ITER; it++) {
    const cool = 1 - it / ITER;
    const maxStep = 1.5 + 14 * cool * cool;
    dx.fill(0);
    dy.fill(0);

    // pairwise repulsion ∝ 1/d² + hard collision push
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = x[i] - x[j];
        let vy = y[i] - y[j];
        let d2 = vx * vx + vy * vy;
        if (d2 < 0.01) {
          vx = rng() - 0.5;
          vy = rng() - 0.5;
          d2 = vx * vx + vy * vy;
        }
        const d = Math.sqrt(d2);
        let f = REPULSE / d2;
        const minDist = nodes[i].r + nodes[j].r + 6;
        if (d < minDist) f += (minDist - d) * 1.6; // resolve overlap firmly
        const fx = (vx / d) * f;
        const fy = (vy / d) * f;
        dx[i] += fx; dy[i] += fy;
        dx[j] -= fx; dy[j] -= fy;
      }
    }

    // springs toward co-investment partners
    for (const e of E) {
      const vx = x[e.j] - x[e.i];
      const vy = y[e.j] - y[e.i];
      const d = Math.sqrt(vx * vx + vy * vy) || 0.01;
      const f = (d - REST) * SPRING * Math.min(e.w, 4);
      const fx = (vx / d) * f;
      const fy = (vy / d) * f;
      dx[e.i] += fx; dy[e.i] += fy;
      dx[e.j] -= fx; dy[e.j] -= fy;
    }

    // gravity toward center (slightly stronger on y — the canvas is wide)
    for (let i = 0; i < n; i++) {
      dx[i] += (CX - x[i]) * GRAVITY;
      dy[i] += (CY - y[i]) * GRAVITY * 1.35;
    }

    // apply with cooling cap, clamp to viewBox
    for (let i = 0; i < n; i++) {
      const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
      const s = Math.min(len, maxStep) / len;
      x[i] += dx[i] * s;
      y[i] += dy[i] * s;
      const m = nodes[i].r + 3;
      x[i] = Math.max(m, Math.min(W - m, x[i]));
      y[i] = Math.max(m + 8, Math.min(H - m - 8, y[i]));
    }
  }

  // final overlap-resolution passes so no two discs intersect
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = x[j] - x[i];
        let vy = y[j] - y[i];
        let d = Math.sqrt(vx * vx + vy * vy);
        const minDist = nodes[i].r + nodes[j].r + 3;
        if (d < minDist) {
          if (d < 0.01) { vx = 1; vy = 0.5; d = 1.118; }
          const push = (minDist - d) / 2;
          const ux = vx / d, uy = vy / d;
          x[i] -= ux * push; y[i] -= uy * push;
          x[j] += ux * push; y[j] += uy * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  for (let i = 0; i < n; i++) {
    const m = nodes[i].r + 3;
    x[i] = Math.max(m, Math.min(W - m, x[i]));
    y[i] = Math.max(m + 8, Math.min(H - m - 8, y[i]));
  }

  return nodes.map((d, i) => ({ ...d, x: x[i], y: y[i] }));
}

const truncate = (s, max = 20) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);

// place labels for the top nodes by degree, skipping any that would collide
function placeLabels(placed) {
  const ranked = [...placed].sort((a, b) => b.degree - a.degree || b.dealCount - a.dealCount).slice(0, LABEL_COUNT);
  const boxes = placed.map((d) => ({ x0: d.x - d.r, x1: d.x + d.r, y0: d.y - d.r, y1: d.y + d.r }));
  const labels = [];
  for (const d of ranked) {
    const text = truncate(d.name);
    const w = text.length * 5.4 + 4; // ≈10px font
    const h = 11;
    const candidates = [
      { x: d.x, y: d.y - d.r - 4, anchor: 'middle' },  // above
      { x: d.x, y: d.y + d.r + 11, anchor: 'middle' }, // below
      { x: d.x + d.r + 4, y: d.y + 3.5, anchor: 'start' },  // right
      { x: d.x - d.r - 4, y: d.y + 3.5, anchor: 'end' },    // left
    ];
    let chosen = null;
    for (const c of candidates) {
      const x0 = c.anchor === 'middle' ? c.x - w / 2 : c.anchor === 'start' ? c.x : c.x - w;
      const box = { x0, x1: x0 + w, y0: c.y - h + 2, y1: c.y + 2 };
      if (box.x0 < 2 || box.x1 > W - 2 || box.y0 < 2 || box.y1 > H - 2) continue;
      const hit = boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
      if (!hit) { chosen = { ...c, text, name: d.name, box }; break; }
    }
    if (chosen) {
      labels.push(chosen);
      boxes.push(chosen.box);
    }
  }
  return labels;
}

export default function NetworkGraph({ deals, meta, set }) {
  const [hover, setHover] = useState(null); // investor name

  const { nodes, edges, labels, neighbors } = useMemo(() => {
    const g = buildGraph(deals ?? []);
    const placed = runLayout(g.nodes, g.edges);
    const nb = new Map(placed.map((d) => [d.name, new Set([d.name])]));
    for (const e of g.edges) {
      nb.get(e.a)?.add(e.b);
      nb.get(e.b)?.add(e.a);
    }
    return { nodes: placed, edges: g.edges, labels: placeLabels(placed), neighbors: nb };
  }, [deals]);

  const pos = useMemo(() => new Map(nodes.map((d) => [d.name, d])), [nodes]);

  const onLeave = useCallback(() => setHover(null), []);

  const hoverSet = hover ? neighbors.get(hover) : null;
  const dim = (name) => (hoverSet && !hoverSet.has(name) ? 0.15 : 1);
  const hovered = hover ? pos.get(hover) : null;

  const subtitle = nodes.length
    ? `${nodes.length} investors · ${edges.length} co-investment ties`
    : undefined;

  return (
    <ChartCard eyebrow="Syndicate map" title="Who invests together" subtitle={subtitle} exportName="network">
      {nodes.length < 2 ? (
        <div
          className="flex items-center justify-center text-center px-6"
          style={{ minHeight: 280, color: 'var(--text-faint)', fontSize: 12.5 }}
        >
          Not enough disclosed co-investment data in this view.
        </div>
      ) : (
        <div className="relative" onMouseLeave={onLeave}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Co-investment network graph">
            {/* edges */}
            <g>
              {edges.map((e) => {
                const a = pos.get(e.a);
                const b = pos.get(e.b);
                if (!a || !b) return null;
                const active = hover && (e.a === hover || e.b === hover);
                return (
                  <line
                    key={e.a + '|' + e.b}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={active ? 'var(--text-dim)' : 'var(--border)'}
                    strokeWidth={Math.min(1 + e.weight, 6)}
                    strokeLinecap="round"
                    opacity={hover ? (active ? 0.9 : 0.12) : 0.75}
                    style={{ transition: 'opacity 0.12s ease, stroke 0.12s ease' }}
                  />
                );
              })}
            </g>
            {/* nodes */}
            <g>
              {nodes.map((d) => (
                <circle
                  key={d.name}
                  cx={d.x} cy={d.y} r={d.r}
                  fill={SEGMENT_COLORS[d.segment] ?? '#6b7688'}
                  stroke={hover === d.name ? 'var(--text)' : 'var(--panel)'}
                  strokeWidth={hover === d.name ? 1.6 : 1}
                  opacity={dim(d.name)}
                  style={{ cursor: 'pointer', transition: 'opacity 0.12s ease' }}
                  onMouseEnter={() => setHover(d.name)}
                  onMouseLeave={onLeave}
                  onClick={() => set?.('search', d.name)}
                >
                  <title>{`${d.name} — ${d.dealCount} deal${d.dealCount === 1 ? '' : 's'}. Click to search.`}</title>
                </circle>
              ))}
            </g>
            {/* labels for the most connected investors */}
            <g pointerEvents="none">
              {labels.map((l) => (
                <text
                  key={l.name}
                  x={l.x} y={l.y}
                  textAnchor={l.anchor}
                  fontSize={10}
                  fill="var(--text-dim)"
                  opacity={dim(l.name)}
                  style={{ transition: 'opacity 0.12s ease' }}
                >
                  {l.text}
                </text>
              ))}
            </g>
          </svg>

          {/* tooltip */}
          {hovered && (
            <div
              className="absolute pointer-events-none fade-enter"
              style={{
                left: `${(hovered.x / W) * 100}%`,
                top: `${(hovered.y / H) * 100}%`,
                transform: `translate(-50%, calc(-100% - ${hovered.r + 8}px))`,
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                borderRadius: 9,
                padding: '7px 10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                whiteSpace: 'nowrap',
                zIndex: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{hovered.name}</div>
              <div className="tnum" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                {hovered.dealCount} deal{hovered.dealCount === 1 ? '' : 's'} · {hovered.degree} co-investor{hovered.degree === 1 ? '' : 's'}
              </div>
              {hovered.segment && (
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: 99, display: 'inline-block',
                      background: SEGMENT_COLORS[hovered.segment] ?? '#6b7688',
                    }}
                  />
                  {segmentLabel(meta, hovered.segment)}
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 6 }}>
            Node size = deals with named co-investors · line weight = shared deals · click a node to search that investor
          </div>
        </div>
      )}
    </ChartCard>
  );
}
