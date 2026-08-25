# Food Tech VC · Investment Dashboard

An interactive dashboard + re-runnable data pipeline analyzing venture capital
into food tech over the trailing twelve months (TTM: **2025-07-21 → 2026-07-20**).

![stack](https://img.shields.io/badge/React-18-61dafb) ![vite](https://img.shields.io/badge/Vite-5-646cff) ![tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Quick start

```bash
npm install
npm run pipeline   # regenerate data/processed + src/data from raw sources
npm run dev        # http://localhost:5173
```

`npm run dev` works out of the box — a normalized snapshot is committed under
`src/data/`, so the pipeline step is only needed after editing the dataset or
configs.

## What's in here

```
pipeline/
  config/taxonomy.yaml     # single source of truth: stages, segments, regions, scope
  config/fx-rates.yaml     # monthly ECB-reference USD rates (reproducible, offline)
  config/overrides.yaml    # optional manual corrections (wins over automation)
  2-normalize.mjs          # dedupe, FX convert, taxonomy-map -> data/processed/deals.json
  3-qa-report.mjs          # coverage stats + caveats -> docs/qa-report.md
data/
  raw/curated/deals.yaml   # hand-assembled source records (with source URLs + confidence)
  processed/               # deals.json, meta.json, warnings.json (generated)
docs/
  schema.md                # deal record schema + normalization rules
  qa-report.md             # generated coverage/QA report
src/                       # React dashboard (Vite)
```

## The dashboard

- **Signals** — a computed analyst brief: 3-month momentum, hottest/fading
  segment, check-size repricing, concentration, data-quality notes — each card
  clickable to apply the underlying filter.
- **Beeswarm ("Every deal, to scale")** — one dot per round across the TTM
  timeline, sized by check, colored by segment; click any dot for full detail.
- **KPI strip** — capital deployed, deal count, median/mean check, top-5
  concentration flag, undisclosed count, active investors.
- **Stage breakdown** — capital & count by stage, plus a per-stage check-size
  distribution strip (min · IQR · median · max).
- **Segment treemap** + **momentum view** — stacked monthly capital by segment
  with an H1→H2 rotation table.
- **Geographic map** — country choropleth + city-hub bubbles.
- **Cross-tabs** — segment × stage and region × segment heatmaps.
- **Syndicate map** — co-investment network graph across ~600 investors.
- **Deal drawer** — click any deal anywhere: amount, valuation, full syndicate,
  sources with links, confidence grade.
- **Command palette (⌘K)** — search deals/investors, apply filters, export.
- **Deal table** — sortable, searchable, with per-row confidence flags.

**Global cross-filtering:** click any chart element (bar, treemap cell, map
country, month, heatmap cell) to filter every other view. Filters: date range,
stage, segment, region, deal-size band, disclosed-only and equity-only toggles.
Filters serialize into the URL — copy the address bar to share any view.
Dark/light themes. Export filtered CSV or any chart as PNG.

## Data & methodology (read before citing)

This is a **curated, agent-assisted and source-verified set** (~150 rounds),
not a market census. Records were assembled from weekly trade-press roundups,
then individually re-verified against primary sources in a second research
pass (stages, leads, amounts, and dates corrected; out-of-scope records
dropped). It is built for trend and structure analysis. Key rules:

- **Undisclosed amounts are never imputed** — they are excluded from every sum
  with a visible caveat.
- **Headline capital** counts disclosed **equity** rounds only. Debt and grants
  stay in the dataset but are excluded from capital totals by default (toggle).
  A round whose stage a source left unspecified still counts as equity capital
  (it is real VC money) but lands in an honest **"Unknown"** stage bucket.
- **FX** converted at monthly-average ECB reference rates for the announcement
  month; the rate table is baked in for reproducibility.
- **Known bias:** public-source aggregation over-represents US/EU, English-
  language press, and larger/hyped rounds; under-represents pre-seed, non-
  English APAC/LATAM press, and quiet extensions. **Totals are floor estimates.**
- **Scope:** consumer food delivery and grocery quick-commerce are excluded, so
  their mega-rounds don't swamp food-innovation totals.

Sources: AgFunderNews weekly "AgriFood Signals" roundups (backbone), plus
TechCrunch, Sifted, EU-Startups, Green Queen, and company press releases. Every
record stores its source URLs and a confidence grade; roundup-extracted records
with ambiguous fields are flagged `verify: true` (shown as `*` in the table).

## Refreshing the data

1. Add/edit records in `data/raw/curated/deals.yaml` (follow `docs/schema.md`).
2. Adjust buckets in `pipeline/config/taxonomy.yaml` if needed.
3. `npm run pipeline` — regenerates the processed dataset and QA report.
4. `npm run dev` (or `npm run build`).
