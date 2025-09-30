import { Injectable, signal } from '@angular/core';
import {
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  ImportResult,
} from '../models/geojson';

@Injectable({
  providedIn: 'root'
})
export class PointService {
  private readonly storageKey = 'poi_editor_state';
  
  // Signals
  private featuresSignal = signal<GeoJSONFeature[]>([]);
  public features = this.featuresSignal.asReadonly();

  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Loads the state stored in localStorage when initializing the service.
  */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed: GeoJSONFeatureCollection = JSON.parse(stored);
        if (this.isValidFeatureCollection(parsed)) {
          this.featuresSignal.set(parsed.features);
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }

  /**
   * Saves the current state of the features in localStorage.
   * Called every time the state changes.
  */
  private saveToLocalStorage(): void {
    const featureCollection: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: this.featuresSignal()
    };
    localStorage.setItem(this.storageKey, JSON.stringify(featureCollection));
  }

  /**
   * Validates whether an object is a valid GeoJSON FeatureCollection.
   * @param geojson Object to validate
   * @returns true if it is a valid FeatureCollection
  */
  private isValidFeatureCollection(
    geojson: GeoJSONFeatureCollection
  ): geojson is GeoJSONFeatureCollection {
    return (
      geojson?.type === 'FeatureCollection' && 
      Array.isArray(geojson.features)
    );
  }

  /**
   * Validates an individual feature.
   * @param feature Feature to validate
   * @returns Object indicating whether it is valid and any errors found
  */
  private validateFeature(feature: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (feature?.type !== 'Feature') {
      errors.push('Not a Feature');
      return { isValid: false, errors };
    }

    if (feature.geometry?.type !== 'Point') {
      errors.push('Geometry must be Point');
      return { isValid: false, errors };
    }

    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      errors.push('Invalid coordinates format');
      return { isValid: false, errors };
    }

    const [lon, lat] = coords;
    if (typeof lon !== 'number' || typeof lat !== 'number') {
      errors.push('Coordinates must be numbers');
      return { isValid: false, errors };
    }

    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      errors.push('Coordinates out of range');
      return { isValid: false, errors };
    }

    if (!feature.properties) {
      errors.push('Missing properties');
      return { isValid: false, errors };
    }

    if (typeof feature.properties.name !== 'string') {
      errors.push('Name must be string');
    }

    if (typeof feature.properties.category !== 'string') {
      errors.push('Category must be string');
    }

    return { 
      isValid: errors.length === 0, 
      errors 
    };
  }

  /**
   * Generates a unique ID for a new feature.
   * @returns Unique ID in string format
   */
  private generateFeatureId(): string {
    return `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Imports a GeoJSON file and updates the status with valid features.
   * @param file GeoJSON file to import
   * @returns Promise with the import result (imported, discarded, and errors)
   */
  public async importGeoJSON(file: File): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const geojson = JSON.parse(content) as GeoJSONFeatureCollection;
          
          if (!this.isValidFeatureCollection(geojson)) {
            throw new Error('Invalid GeoJSON: must be FeatureCollection');
          }

          const result: ImportResult = {
            imported: 0,
            discarded: 0,
            errors: []
          };

          const validFeatures: GeoJSONFeature[] = [];

          geojson.features.forEach((feature: any, index: number) => {
            const validation = this.validateFeature(feature);
            
            if (validation.isValid) {
              // Asegurar que cada feature tenga un ID único
              const validFeature: GeoJSONFeature = {
                ...feature,
                id: feature.id || this.generateFeatureId()
              };
              validFeatures.push(validFeature);
              result.imported++;
            } else {
              result.discarded++;
              result.errors.push(`Feature ${index}: ${validation.errors.join(', ')}`);
            }
          });

          this.featuresSignal.set(validFeatures);
          this.saveToLocalStorage();
          resolve(result);

        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsText(file);
    });
  }

  /**
   * Exports the current feature state to a GeoJSON string.
   * @returns Formatted JSON string of the current FeatureCollection
  */
  public exportGeoJSON(): string {
    const featureCollection: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: this.featuresSignal()
    };
    return JSON.stringify(featureCollection, null, 2);
  }

  /**
   * Clears all service data and removes the item from localStorage.
  */
  public clearData(): void {
    this.featuresSignal.set([]);
    localStorage.removeItem(this.storageKey);
  }

}