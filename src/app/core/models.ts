export type LngLat = [number, number];

export interface MapPoint {
  id: string;
  name: string;
  description: string;
  category: string;
  color: string;
  lng: number;
  lat: number;
  createdAt: string;
  updatedAt: string;
}

export type PointDraft = Pick<MapPoint, 'name' | 'description' | 'category' | 'color' | 'lng' | 'lat'>;

export interface ImportResult {
  points: MapPoint[];
  discarded: number;
  errors: string[];
}

export const POINT_COLORS = [
  '#22d3ee',
  '#818cf8',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#f472b6',
  '#a3e635',
  '#fb923c',
] as const;

export const DEFAULT_COLOR = POINT_COLORS[0];
