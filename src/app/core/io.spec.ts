import { detectFormat, parseCSV, parseGeoJSON, splitCsv, toCSV, toGeoJSON } from './io';
import { MapPoint } from './models';

const point = (over: Partial<MapPoint> = {}): MapPoint => ({
  id: 'a',
  name: 'Museo del Oro',
  description: 'Centro, "Bogotá"',
  category: 'Museo',
  color: '#fbbf24',
  lng: -74.07206,
  lat: 4.60188,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('GeoJSON', () => {
  it('round-trips points', () => {
    const result = parseGeoJSON(toGeoJSON([point(), point({ id: 'b', name: 'Otro' })]));
    expect(result.points.length).toBe(2);
    expect(result.points[0]).toMatchObject({ id: 'a', name: 'Museo del Oro', category: 'Museo', color: '#fbbf24', lng: -74.07206, lat: 4.60188 });
  });

  it('discards non-points and invalid coordinates, and maps Spanish keys', () => {
    const text = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-75.5, 6.2] }, properties: { nombre: 'Parque', categoria: 'Parque', color: 'nope' } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [200, 0] }, properties: {} },
      ],
    });
    const r = parseGeoJSON(text);
    expect(r.points.length).toBe(1);
    expect(r.discarded).toBe(2);
    expect(r.points[0].name).toBe('Parque');
    expect(r.points[0].category).toBe('Parque');
    expect(r.points[0].color).toBe('#22d3ee');
  });

  it('accepts the legacy point-editor format and rejects invalid files', () => {
    const legacy = JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 'feature_1', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { name: 'Viejo', category: '', _featureId: 'feature_1' } }],
    });
    expect(parseGeoJSON(legacy).points[0]).toMatchObject({ id: 'feature_1', name: 'Viejo', lng: 1, lat: 2 });
    expect(() => parseGeoJSON('no json')).toThrowError(/JSON válido/);
    expect(() => parseGeoJSON('{"type":"Point"}')).toThrowError(/FeatureCollection/);
  });
});

describe('CSV', () => {
  it('splits quoted fields with delimiters and newlines', () => {
    expect(splitCsv('a,"b,c","d ""e"""\n1,2,3\n', ',')).toEqual([
      ['a', 'b,c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('round-trips through CSV', () => {
    const r = parseCSV(toCSV([point()]));
    expect(r.points.length).toBe(1);
    expect(r.points[0]).toMatchObject({ name: 'Museo del Oro', description: 'Centro, "Bogotá"', lat: 4.60188, lng: -74.07206 });
  });

  it('detects semicolons, Spanish headers and decimal commas', () => {
    const r = parseCSV('nombre;latitud;longitud;categoria\nCafé;4,6;-74,07;Comida\nMalo;x;y;z\n');
    expect(r.points.length).toBe(1);
    expect(r.discarded).toBe(1);
    expect(r.points[0]).toMatchObject({ name: 'Café', lat: 4.6, lng: -74.07, category: 'Comida' });
  });

  it('requires coordinate columns and guards against formula injection', () => {
    expect(() => parseCSV('name,city\nA,B\n')).toThrowError(/latitud/);
    expect(toCSV([point({ name: '=HYPERLINK("x")' })])).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('detects the format', () => {
    expect(detectFormat('a.geojson', '')).toBe('geojson');
    expect(detectFormat('a.csv', '{')).toBe('csv');
    expect(detectFormat('a.txt', ' {"type"')).toBe('geojson');
  });
});
