import { GeoJSONFeature } from "./geojson";

export interface SearchFilters {
  name: string;
  category: string;
}

export interface FilteredFeatures {
  features: GeoJSONFeature[];
  total: number;
  filtered: number;
}