import { formatDistance, haversine, isValidLngLat, pathLength } from './geo';

describe('geo', () => {
  it('computes great-circle distance (Bogotá → Medellín ≈ 240 km)', () => {
    const d = haversine([-74.0721, 4.711], [-75.5636, 6.2442]);
    expect(d / 1000).toBeGreaterThan(230);
    expect(d / 1000).toBeLessThan(250);
  });

  it('returns 0 for the same position and sums paths', () => {
    expect(haversine([1, 1], [1, 1])).toBe(0);
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0, 1];
    const c: [number, number] = [0, 2];
    expect(pathLength([a, b, c])).toBeCloseTo(haversine(a, c), 3);
    expect(pathLength([a])).toBe(0);
  });

  it('formats meters and kilometers in Spanish', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(1500)).toBe('1,5 km');
    expect(formatDistance(123_456)).toBe('123,5 km');
  });

  it('validates coordinates', () => {
    expect(isValidLngLat(-74, 4.6)).toBe(true);
    expect(isValidLngLat(181, 0)).toBe(false);
    expect(isValidLngLat(0, -91)).toBe(false);
    expect(isValidLngLat('1', 2)).toBe(false);
    expect(isValidLngLat(NaN, 2)).toBe(false);
  });
});
