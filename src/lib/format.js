export const SEGMENT_COLORS = {
  'alt-protein': '#4cc9b0',
  'precision-fermentation': '#7aa2f7',
  'agtech-upstream': '#8fce6b',
  'food-robotics': '#f6a24a',
  'supply-chain': '#5fb3e0',
  'd2c-cpg': '#e06c9f',
  'restaurant-tech': '#b58cf0',
  'food-waste': '#e5c454',
  'personalized-nutrition': '#3fb0a3',
  'packaging': '#ef7d6a',
  'ingredients-biotech': '#c98bbb',
};

export const REGION_COLORS = {
  NA: '#4cc9b0',
  EU: '#7aa2f7',
  UK: '#e06c9f',
  APAC: '#f6a24a',
  MENA: '#e5c454',
  LATAM: '#b58cf0',
  Africa: '#8fce6b',
  Other: '#6b7688',
};

export const STAGE_ORDER = [
  'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C',
  'Series D+', 'Growth', 'Debt', 'Grant', 'Unknown',
];

export const STAGE_COLORS = {
  'Pre-seed': '#3fb0a3',
  'Seed': '#4cc9b0',
  'Series A': '#5fb3e0',
  'Series B': '#7aa2f7',
  'Series C': '#b58cf0',
  'Series D+': '#e06c9f',
  'Growth': '#f6a24a',
  'Debt': '#8a94a6',
  'Grant': '#e5c454',
  'Unknown': '#4a5568',
};

export function fmtUsd(n, { compact = true } = {}) {
  if (n == null) return '—';
  if (!compact) return '$' + Math.round(n).toLocaleString('en-US');
  const abs = Math.abs(n);
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(abs >= 1e8 ? 0 : 1) + 'M';
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

export function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[+m - 1]} ${y.slice(2)}`;
}

export function segmentLabel(meta, key) {
  return meta.segments?.[key]?.label ?? key;
}

export const COUNTRY_NAMES = {
  US: 'United States', CA: 'Canada', MX: 'Mexico', GB: 'United Kingdom',
  DE: 'Germany', FR: 'France', NL: 'Netherlands', ES: 'Spain', IT: 'Italy',
  SE: 'Sweden', DK: 'Denmark', FI: 'Finland', NO: 'Norway', IE: 'Ireland',
  BE: 'Belgium', AT: 'Austria', CH: 'Switzerland', PT: 'Portugal', PL: 'Poland',
  EE: 'Estonia', IL: 'Israel', AE: 'UAE', SA: 'Saudi Arabia', TN: 'Tunisia',
  CN: 'China', IN: 'India', JP: 'Japan', KR: 'South Korea', SG: 'Singapore',
  AU: 'Australia', NZ: 'New Zealand', ID: 'Indonesia', PH: 'Philippines',
  BR: 'Brazil', AR: 'Argentina', ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya',
  CL: 'Chile', CZ: 'Czechia', EG: 'Egypt', GR: 'Greece', IS: 'Iceland', LT: 'Lithuania',
};

export const countryName = (iso) => COUNTRY_NAMES[iso] ?? iso ?? '—';

export const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
