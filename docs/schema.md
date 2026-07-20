# Deal record schema (proposed)

One JSON record per financing round, stored in `data/processed/deals.json`.
Raw scraped material is kept per-source in `data/raw/` so the pipeline is
re-runnable and every normalized value is traceable to a source.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug: `<company-slug>-<yyyy-mm>-<stage-slug>`, dedupe key |
| `company` | string | Display name after dedupe (canonical casing) |
| `company_aliases` | string[] | Names seen in sources that map to this company |
| `date` | ISO date | Announcement date (close date when disclosed — flagged in `date_basis`) |
| `date_basis` | enum | `close` \| `announcement` |
| `date_precision` | enum | `day` \| `month` (some sources only give the month) |
| `stage_raw` | string | Verbatim label from source |
| `stage` | enum | Canonical stage from taxonomy.yaml |
| `amount_raw` | {value, currency} \| null | As reported; null = undisclosed |
| `amount_usd` | number \| null | Converted at ECB reference rate on `date`; null = undisclosed |
| `fx_rate_date` | ISO date \| null | Date of the rate used (normally = `date`) |
| `amount_disclosed` | boolean | Drives the disclosed-only toggle and sum caveats |
| `valuation_usd` | number \| null | Post-money when stated; `valuation_basis`: `pre` \| `post` \| null |
| `lead_investors` | string[] | Normalized investor names; empty = no lead disclosed |
| `investors` | string[] | All disclosed investors incl. leads, normalized |
| `investor_count` | number \| null | Count of *disclosed* investors; null if sources only say "and others" |
| `investors_partial` | boolean | true when sources indicate the list is incomplete |
| `hq_city` | string \| null | |
| `hq_country` | ISO-3166 alpha-2 | |
| `region` | enum | Derived from taxonomy.yaml (NA/EU/UK/APAC/MENA/LATAM/Africa/Other) |
| `segments` | string[] | Segment keys from taxonomy.yaml (multi-label) |
| `primary_segment` | string | Exactly one of `segments` |
| `sources` | {name, url, retrieved}[] | Every source consulted for this record |
| `confidence` | enum | `high` (2+ corroborating sources) \| `medium` (single reputable source) \| `low` (press release only / ambiguous) |
| `notes` | string \| null | Free-text caveats (e.g., "tranche 2 of previously announced round") |

## Normalization rules

- **Dedupe**: same company + same amount ±10% + dates within 45 days = one
  round; extensions reported separately are merged with a note. Company
  matching is fuzzy (normalized name, domain when available) with a manual
  overrides file (`pipeline/config/overrides.yaml`) as the final arbiter.
- **Undisclosed amounts**: never imputed. `amount_usd: null`, excluded from
  all sums; every aggregate in the dashboard shows "n of m deals disclosed".
- **FX**: converted at the ECB daily reference rate for `fx_rate_date`
  (deal announcement date). Rates fetched by the pipeline and cached in
  `data/raw/fx/` so runs are reproducible.
- **Debt & grants**: kept in the dataset, excluded from headline equity
  totals by default (toggle in UI).
- **Multi-label segments**: auto-tagged from keywords, then human-reviewed;
  aggregations by segment use `primary_segment` to avoid double-counting,
  with an "any-label" mode available in the segment view.

## Pipeline shape

```
pipeline/
  config/taxonomy.yaml     <- this proposal (editable)
  config/overrides.yaml    <- manual corrections, wins over automation
  1-collect.mjs            <- per-source scrapers -> data/raw/<source>/*.json
  2-normalize.mjs          <- dedupe, FX, taxonomy mapping -> data/processed/deals.json
  3-qa-report.mjs          <- unmatched stages/countries, low-confidence deals, coverage stats
```

Node-only repo (no Python), so `npm install && npm run pipeline && npm run dev`
is the whole toolchain.

## Known coverage bias (will be stated in the methodology section)

Public-source aggregation over-represents: US/EU deals, English-language
press, larger rounds, and venture-hyped segments (alt-protein). It
under-represents: pre-seed/angel rounds, APAC/LATAM deals covered only in
local-language press, and quiet extensions. The dashboard will show a
coverage note and per-region confidence indicators rather than pretending
to PitchBook-grade completeness.
