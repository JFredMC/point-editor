import { isValidLngLat } from './geo';
import { newId } from './id';
import { DEFAULT_COLOR, ImportResult, MapPoint } from './models';

const HEX = /^#(?:[0-9a-f]{3}){1,2}$/i;
type Props = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function pick(props: Props, keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(props).find((k) => k.toLowerCase() === key);
    if (found && str(props[found])) return str(props[found]);
  }
  return '';
}

function build(props: Props, lng: number, lat: number, id?: unknown): MapPoint {
  const now = new Date().toISOString();
  const color = pick(props, ['color', 'marker-color', 'colour']);
  return {
    id: typeof id === 'string' && id ? id : newId(),
    name: pick(props, ['name', 'nombre', 'title', 'titulo']).slice(0, 80) || 'Sin nombre',
    description: pick(props, ['description', 'descripcion', 'descripción', 'desc']).slice(0, 500),
    category: pick(props, ['category', 'categoria', 'categoría', 'type', 'tipo']).slice(0, 40),
    color: HEX.test(color) ? color.toLowerCase() : DEFAULT_COLOR,
    lng,
    lat,
    createdAt: pick(props, ['createdat']) || now,
    updatedAt: now,
  };
}

/** Parses a GeoJSON FeatureCollection (or single Feature); only Point features are kept. */
export function parseGeoJSON(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const obj = data as { type?: string; features?: unknown[] };
  const features = obj?.type === 'FeatureCollection' && Array.isArray(obj.features) ? obj.features : obj?.type === 'Feature' ? [obj] : null;
  if (!features) throw new Error('El GeoJSON debe ser un FeatureCollection o un Feature.');

  const result: ImportResult = { points: [], discarded: 0, errors: [] };
  const seen = new Set<string>();
  features.forEach((raw, index) => {
    const f = raw as { type?: string; id?: unknown; geometry?: { type?: string; coordinates?: unknown }; properties?: Props | null };
    const coords = f?.geometry?.coordinates;
    if (f?.type !== 'Feature' || f.geometry?.type !== 'Point' || !Array.isArray(coords)) {
      result.discarded++;
      result.errors.push(`Elemento ${index + 1}: no es un punto.`);
      return;
    }
    const [lng, lat] = coords as unknown[];
    if (!isValidLngLat(lng, lat)) {
      result.discarded++;
      result.errors.push(`Elemento ${index + 1}: coordenadas inválidas.`);
      return;
    }
    const props = f.properties ?? {};
    let id = f.id ?? props['_featureId'];
    if (typeof id !== 'string' || seen.has(id)) id = undefined;
    const point = build(props, lng as number, lat as number, id);
    seen.add(point.id);
    result.points.push(point);
  });
  return result;
}

export function toGeoJSON(points: MapPoint[]): string {
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          name: p.name,
          description: p.description,
          category: p.category,
          color: p.color,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
      })),
    },
    null,
    2,
  );
}

/** RFC 4180-ish CSV line splitter with quotes; auto-detected delimiter. */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export function parseCSV(text: string): ImportResult {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', '\t', ','].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');
  const rows = splitCsv(clean, delimiter);
  if (rows.length < 2) throw new Error('El CSV no tiene filas de datos.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const latI = col('lat', 'latitude', 'latitud', 'y');
  const lngI = col('lng', 'lon', 'long', 'longitude', 'longitud', 'x');
  if (latI < 0 || lngI < 0) throw new Error('El CSV necesita columnas de latitud y longitud (lat, lng).');

  const result: ImportResult = { points: [], discarded: 0, errors: [] };
  rows.slice(1).forEach((cells, index) => {
    const num = (v: string | undefined) => (v === undefined || v.trim() === '' ? NaN : Number(v.trim().replace(',', '.')));
    const lat = num(cells[latI]);
    const lng = num(cells[lngI]);
    if (!isValidLngLat(lng, lat)) {
      result.discarded++;
      result.errors.push(`Fila ${index + 2}: coordenadas inválidas.`);
      return;
    }
    const props: Props = {};
    header.forEach((h, i) => (props[h] = cells[i] ?? ''));
    result.points.push(build(props, lng, lat));
  });
  return result;
}

function csvCell(value: string | number): string {
  const s = String(value);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof value === 'string' ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(points: MapPoint[]): string {
  const header = ['name', 'description', 'category', 'color', 'lat', 'lng'];
  const lines = points.map((p) => [p.name, p.description, p.category, p.color, p.lat, p.lng].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\n') + '\n';
}

export function detectFormat(fileName: string, text: string): 'geojson' | 'csv' {
  if (/\.(geo)?json$/i.test(fileName)) return 'geojson';
  if (/\.csv$/i.test(fileName)) return 'csv';
  return text.trimStart().startsWith('{') ? 'geojson' : 'csv';
}
