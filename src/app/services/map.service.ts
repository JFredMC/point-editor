import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { GeoJSONSource, Map, MapMouseEvent, Marker, NavigationControl, Popup } from 'maplibre-gl';
import { PointService } from './point.service';
import { GeoJSONFeature } from '../models/geojson';
import { MapConfig } from '../models/map.interface';

/**
 * Default map configuration
 */
const default_map_config: MapConfig = {
  center: [-70.6483, -33.4569],
  zoom: 2,
  style: 'https://tiles.stadiamaps.com/styles/osm_bright.json'
};
@Injectable({
  providedIn: 'root'
})
export class MapService {
  // Services
  private readonly destroyRef = inject(DestroyRef);
  private readonly pointService = inject(PointService);

  /** Main MapLibre GL map instance */
  private map: Map | undefined;
  private tempMarker: Marker | null = null;

  /** Popup instance for displaying feature information */
  private popup: Popup | null = null;

  // Signals
  public readonly selectedFeature = signal<GeoJSONFeature | null>(null);
  public readonly clickCoordinates = signal<[number, number] | null>(null);
  private readonly currentFeatures = computed(() => this.pointService.features());

  constructor() {
     effect(() => {
      const features = this.currentFeatures();
      
      if (this.map) {
        this.updateMapFeatures(features);
      }
    });
  }

  /**
   * Initializes and configures the MapLibre GL map instance
   * 
   * @param container - HTML element that will contain the map
   * @param config - Optional configuration to override default map settings
   * @throws {Error} If container element is invalid
   * 
   */
  public initializeMap(
    container: HTMLElement,
    config: Partial<MapConfig> = {}
  ): void {
    if (this.map) {
      console.warn('Map is already initialized');
      return;
    }

    if (!container) {
      throw new Error('Container element is required for map initialization');
    }

    const finalConfig = { ...default_map_config, ...config };

    this.map = new Map({
      container,
      style: finalConfig.style,
      center: finalConfig.center,
      zoom: finalConfig.zoom,
      attributionControl: false,
    });

    this.setupMapControls();
    this.setupMapEventHandlers();
  }


  /**
   * Sets up map controls and initializes layers once map is loaded
   */
  private setupMapControls(): void {
    if (!this.map) return;

    this.map.addControl(new NavigationControl());

    this.map.on('load', () => {
      this.initializeLayers();
      this.setupEventListeners();
     this.updateMapFeatures(this.currentFeatures());
    });
  }

  /**
   * Sets up global map event handlers
   */
  private setupMapEventHandlers(): void {
    if (!this.map) return;

    // Handle map destruction when component is destroyed
    this.destroyRef.onDestroy(() => {
      this.destroyMap();
    });
  }

  /**
   * Initializes GeoJSON sources and layers for Points of Interest
   */
  private initializeLayers(): void {
    if (!this.map) return;

    try {
      this.map.addSource('pois', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      this.map.addLayer({
        id: 'poi-circles',
        type: 'circle',
        source: 'pois',
        paint: {
          'circle-radius': 6,
          'circle-color': '#007bff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });


      this.map.addLayer({
        id: 'poi-labels',
        type: 'symbol',
        source: 'pois',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      });
      this.map.addLayer({
        id: 'poi-labels',
        type: 'symbol',
        source: 'pois',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      });

    } catch (error) {
      console.error('Failed to initialize map layers:', error);
    }
  }

  /**
   * Sets up event listeners for map interactions
   */
  private setupEventListeners(): void {
    if (!this.map) return;

    this.map.on('click', (e: MapMouseEvent) => {
      this.handleMapClick(e);
    });

    this.map.on('click', 'poi-circles', (e) => {
      this.handleFeatureClick(e);
    });

    this.map.on('mouseenter', 'poi-circles', () => {
      this.setCursor('pointer');
    });

    this.map.on('mouseleave', 'poi-circles', () => {
      this.setCursor('');
    });
  }

  /**
   * Handles map click events for setting coordinates
   */
  private handleMapClick(e: MapMouseEvent): void {
    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    this.clickCoordinates.set(coordinates);
    this.showTempMarker(coordinates);
  }

  /**
   * Handles feature click events for selection and popup display
   */
  private handleFeatureClick(e: any): void {
    if (e.features?.[0]) {
      const feature = e.features[0] as GeoJSONFeature;
      this.selectedFeature.set(feature);
      this.showFeaturePopup(e.lngLat, feature);
      this.removeTempMarker();
    }
  }

  /**
   * Sets the canvas cursor style
   */
  private setCursor(cursor: string): void {
    this.map?.getCanvas().style?.setProperty('cursor', cursor);
  }

  /**
   * Updates map features in the GeoJSON source
   */
  private updateMapFeatures(features: GeoJSONFeature[]): void {
    if (!this.map) return;

    const source = this.map.getSource('pois') as GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: features
      });
    }
  }

  /**
   * Displays a popup with feature information at specified coordinates
   */
  private showFeaturePopup(lngLat: any, feature: GeoJSONFeature): void {
    if (!this.map) return;

    this.removeExistingPopup();

    const { properties } = feature;
    const coordinates = this.clickCoordinates();

    this.popup = new Popup()
      .setLngLat(lngLat)
      .setHTML(this.generatePopupContent(properties, coordinates))
      .addTo(this.map);
  }

  /**
   * Removes existing popup from the map
   */
  private removeExistingPopup(): void {
    this.popup?.remove();
    this.popup = null;
  }

  /**
   * Generates HTML content for the feature popup
   */
  private generatePopupContent(properties: any, coordinates: [number, number] | null): string {
    return `
      <div class="p-2">
        <h6>${properties['name'] || 'Unnamed'}</h6>
        <p class="mb-1"><strong>Category:</strong> ${properties['category'] || 'Unknown'}</p>
        ${coordinates ? `
          <p class="mb-1"><strong>Coordinates:</strong>
            ${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}
          </p>
        ` : ''}
        <small class="text-muted">Click elsewhere to close</small>
      </div>
    `;
  }

  private showTempMarker(coordinates: [number, number]): void {
    // Remover marcador anterior si existe
    this.removeTempMarker();
    this.selectedFeature.set(null);

    if (!this.map) return;
    if (!this.popup) return;

    this.tempMarker = new Marker({
      color: "#ff0404ff",
      anchor: 'center',
      draggable: true
    })
      .setLngLat(coordinates)
      .addTo(this.map);
  }

  /**
   * Remueve el marcador temporal
   */
  private removeTempMarker(): void {
    if (this.tempMarker) {
      this.tempMarker.remove();
      this.tempMarker = null;
    }
  }

  /**
   * Clears current selection and removes popup
   */
  public clearSelection(): void {
    this.selectedFeature.set(null);
    this.clickCoordinates.set(null);
    this.removeTempMarker();
    this.removeExistingPopup();
  }

  /**
   * Returns the current map instance
   * 
   * @returns Current Map instance or undefined if not initialized
   */
  public getMap(): Map | undefined {
    return this.map;
  }

  /**
   * Safely destroys the map instance and cleans up resources
   */
  public destroyMap(): void {
    this.clearSelection();
    
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }
}