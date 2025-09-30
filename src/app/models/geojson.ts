export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    name: string;
    category: string;
    [key: string]: any;
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface ImportResult {
  imported: number;
  discarded: number;
  errors: string[];
}

export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: PointGeometry;
  properties: IProperty;
  id?: string | number;
}

export interface IProperty {
  name: string;
  category: string;
  [key: string]: any;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface ImportResult {
  imported: number;
  discarded: number;
  errors: string[];
}

export interface PointFormData {
  name: string;
  category: string;
}

export interface PointFormModalData {
  feature?: GeoJSONFeature;
  coordinates?: [number, number];
  mode: 'add' | 'edit';
}