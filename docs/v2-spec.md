# V2 component build spec

You are building ONE component for the Food Tech VC dashboard (React 18 + Vite +
Tailwind + Recharts 2 + d3-scale). Read this whole file, then study:

- `src/lib/format.js` — fmtUsd, fmtMonth, segmentLabel(meta,key), countryName,
  median, mean, SEGMENT_COLORS, STAGE_COLORS, STAGE_ORDER, REGION_COLORS
- `src/lib/analytics.js` — existing rollups (kpis, byStage, bySegment, monthlySeries, topInvestors…)
- `src/lib/export.js` — downloadCsv(deals), chartToPng(node, filename, bg)
- `src/components/ChartCard.jsx` — the standard card wrapper (use it unless told otherwise)
- `src/index.css` — CSS variables + utility classes
- `src/data/deals.json` (first 2 records) and `src/data/meta.json` — data shapes

## Hard rules

1. Write ONLY the file(s) assigned to you. Never edit shared files (App.jsx,
   index.css, package.json, lib/*, other components). Never run npm/git.
2. Plain JS + JSX (no TypeScript). Default-export a React function component.
3. No new dependencies. Allowed imports: react, recharts, d3-scale, and the
   project's own `../lib/*` modules + `./ChartCard.jsx`.
4. Theme via CSS variables only — never hardcode background/text colors except
   the segment/stage palette constants from format.js. The app has dark AND
   light themes; both must look right. Available vars: --bg, --panel, --panel-2,
   --border, --border-soft, --text, --text-dim, --text-faint, --accent, --grid.
5. Utility classes available: `panel`, `eyebrow`, `chip` (+ data-active),
   `btn`, `tnum`, `mono`, `display` (Fraunces serif — headlines only),
   `cell-clickable`, `fade-enter`, `backdrop`, `drawer`, `palette`,
   `insight-card` (+ data-clickable), `kbd`.
6. Every interactive element needs a hover state and a title/tooltip.
   Handle the empty state (0 deals after filtering) gracefully.
7. Amounts: only `amount_disclosed && is_equity` deals count toward capital
   sums. Undisclosed is never imputed — show "undisclosed", never 0.
8. Keep it dense and editorial: 10-13px labels, eyebrow headers, tabular
   numbers, restrained color. No chart-library default styling.
9. `Math.random()` allowed but prefer deterministic layouts (seeded LCG) so
   re-renders are stable. Memoize expensive layout with useMemo.

## Deal record shape (src/data/deals.json)

```json
{
  "id": "oishii-2026-05-series-c", "company": "Oishii",
  "date": "2026-05-14", "month": "2026-05", "date_precision": "day",
  "stage": "Series C", "stage_raw": "Series C (first close)", "is_equity": true,
  "amount_raw": { "value": 150000000, "currency": "USD" },
  "amount_usd": 150000000, "amount_disclosed": true,
  "valuation_usd": null,
  "lead_investors": ["…"], "investors": ["…"], "investor_count": 3,
  "hq_city": "Jersey City", "hq_country": "US", "region": "NA",
  "segments": ["agtech-upstream"], "primary_segment": "agtech-upstream",
  "sources": [{ "name": "…", "url": "https://…", "retrieved": "2026-07-20" }],
  "confidence": "medium", "verify": true, "notes": null
}
```

`meta.json`: `{ ttm_window: {start, end}, segments: {key: {label, description}},
stages: [...], regions: [...], deal_count, ... }`

## Component contracts (one agent each)

### A. `src/lib/insights.js` + `src/components/InsightsPanel.jsx`
`computeInsights(deals, allDeals, window)` → array of up to 8 insight objects:
`{ id, eyebrow, headline, body, spark, action, tone }` where
- `headline` = the stat ("$212M", "3.2× median step-up", "41% of capital")
- `body` = one crisp analyst sentence explaining why it matters (investor voice,
  no fluff: "Series A medians doubled in H2 — the seed-to-A bar is rising.")
- `spark` = optional array of numbers for a mini sparkline (monthly values)
- `action` = optional `{ type: 'segments'|'stages'|'regions', value }` — clicking
  the card applies that filter via toggleValue(type, value)
- `tone` = 'up' | 'down' | 'flat' | 'warn' (colors the delta glyph)

Compute at least: (1) 3-month momentum — capital+count last 3 full months vs
prior 3; (2) hottest segment by H2-vs-H1 disclosed capital growth (min 3 deals);
(3) coldest/fading segment; (4) median check trend for the most active stage;
(5) top-5 concentration with the actual top deal named; (6) undisclosed-rate
data-quality note; (7) busiest hub city; (8) most active lead investor.
Guard every division; skip cards whose inputs are too thin (< 3 deals).
`InsightsPanel({ deals, allDeals, meta, window, toggleValue })` renders a
responsive grid (2-4 cols) of `insight-card`s: eyebrow, big tnum headline with
tone glyph (▲▼◆), body text, 40px-tall sparkline (pure SVG polyline, accent
stroke). Title the section "Signals" with eyebrow "What the data says".

### B. `src/components/Beeswarm.jsx`
`Beeswarm({ deals, window, onSelectDeal, filters })` — THE flagship view.
Every deal is a dot: x = announcement date across the TTM window, y = swarm
offset (collision-relaxed), r = sqrt(amount_usd) scaled to [3, 26]px;
undisclosed deals get r=3 hollow circles (stroke only). Fill = SEGMENT_COLORS
[primary_segment]. Deterministic relaxation: sort by date, ~80 iterations
pushing overlapping circles apart vertically from a y=center start (seeded
jitter). Pure SVG in a ChartCard (title "Every deal, to scale", eyebrow
"The market at a glance", exportName "beeswarm"). Month gridlines + labels on
x-axis. Hover: highlight dot (stroke var(--text)), tooltip div (absolute) with
company, fmtUsd, stage, segment label. Click → onSelectDeal(deal). Deals
matching active segment filters render full opacity; others 0.25. Height ~360.
A subtle legend of the 6 largest segments below. viewBox responsive width via
ResizeObserver or width 100% + fixed viewBox 1100×360.

### C. `src/components/NetworkGraph.jsx`
`NetworkGraph({ deals, meta, set })` — co-investment map. Nodes = investors in
≥1 deal that has ≥2 disclosed investors; edge between investors sharing a deal,
weight = shared deals. Node r = 4 + 3·sqrt(dealCount), fill = SEGMENT_COLORS of
their modal primary_segment, label the top ~12 nodes by degree (10px, --text-dim).
Layout: simple force sim in useMemo — 250 iterations, repulsion ∝ 1/d², spring
toward edge partners, gravity to center, seeded LCG start positions; clamp to
viewBox 560×380. Edges: stroke var(--border), width 1+weight. Hover node:
highlight its edges+neighbors (others fade to 0.15), tooltip with investor name,
deal count, focus segment. Click → set('search', investorName). ChartCard title
"Who invests together", eyebrow "Syndicate map", exportName "network". Empty
state: "Not enough disclosed co-investment data in this view."

### D. `src/components/DealDrawer.jsx`
`DealDrawer({ deal, meta, onClose })` — renders null when !deal. Otherwise
`backdrop` (click = close) + `drawer` panel: eyebrow stage + date; company name
in `display` serif 26px; description; amount block (big tnum USD + raw currency
note, or "Undisclosed" + explanation); valuation row if present; grid of meta
rows (HQ city+country w/ countryName, region, investor_count, confidence badge
w/ verify note); segment chips (colored dot + label); investors list — leads
first with a "Lead" tag; sources as external links (name + domain, target
_blank rel noopener); notes in italic if present. Esc key closes (useEffect
keydown). Footer: deal id in mono 10px --text-faint.

### E. `src/components/CommandPalette.jsx`
`CommandPalette({ deals, meta, filters, set, toggleValue, reset, onSelectDeal })`
Self-managed open state: window keydown ⌘K / Ctrl+K toggles, Esc closes; also
listens for a custom `window` event `'open-palette'` so the header button can
`window.dispatchEvent(new Event('open-palette'))`. Renders null when closed;
else `backdrop` + `palette`: search input (autofocus) + result list (max ~12,
keyboard ↑↓ + Enter, hover). Result groups: (1) matching deals by company/
investor substring → onSelectDeal(deal) (show company, fmtUsd, stage);
(2) filter actions: "Filter stage: X" for each matching stage, same for
segments (label match) and regions → toggleValue; (3) commands: "Reset all
filters" → reset(); "Toggle disclosed only" → set('disclosedOnly', !…);
"Toggle equity only" → set('includeDebtGrant', !…); "Export CSV of current
view" → downloadCsv(deals); "Toggle theme" → document.documentElement.classList
dance (swap 'dark'/'light', persist localStorage 'ft-theme'). Footer bar with
kbd hints (↑↓ navigate · ↵ select · esc close).

### F. `src/components/MomentumChart.jsx`
`MomentumChart({ deals, window, meta, toggleValue, filters })` — replaces the
old TimeSeries as the trend view. Recharts stacked AreaChart: monthly disclosed
equity capital stacked by the top 5 segments (by total capital in view) +
"Other" (color #6b7688 at 0.5 opacity); continuous months from window.start to
window.end (reuse monthlySeries logic by writing a local groupper-month-per-
segment helper). $/# metric toggle (chips). Custom tooltip (panel style)
listing that month's segments sorted desc with colored dots. Legend chips under
the chart: click → toggleValue('segments', key), data-active when filtered.
Below, a compact "H1 → H2" table: per segment, disclosed capital first-half vs
second-half of window with an arrow glyph and % delta (guard div-by-zero; "new"
when H1=0). ChartCard: eyebrow "Momentum", title "Where capital is rotating",
exportName "momentum".
