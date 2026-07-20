// CSV of the filtered view + PNG of an individual chart node (no external deps).

export function downloadCsv(deals, filename = 'foodtech-deals.csv') {
  const cols = [
    'company', 'date', 'stage', 'amount_usd', 'amount_disclosed',
    'primary_segment', 'segments', 'hq_city', 'hq_country', 'region',
    'lead_investors', 'investors', 'investor_count', 'valuation_usd',
    'confidence', 'notes',
  ];
  const esc = (v) => {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join('; ') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [cols.join(',')];
  for (const d of deals) rows.push(cols.map((c) => esc(d[c])).join(','));
  triggerDownload(new Blob([rows.join('\n')], { type: 'text/csv' }), filename);
}

// Serialize an SVG-based chart to PNG. Recharts renders <svg>, so we grab it,
// inline computed colors, rasterize onto a canvas, and export.
export async function chartToPng(node, filename = 'chart.png', bg = '#0f1218') {
  const svg = node?.querySelector('svg');
  if (!svg) return;
  const clone = svg.cloneNode(true);
  const { width, height } = svg.getBoundingClientRect();
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const data = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  const scale = 2;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  canvas.toBlob((blob) => triggerDownload(blob, filename), 'image/png');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
