import type * as GeoJSON from 'geojson';
import { effect, inject, Injectable } from '@angular/core';
import maplibregl, { GeoJSONSource, LngLatBounds, Map as MlMap, MapMouseEvent, Marker } from 'maplibre-gl';
import { LngLat, MapPoint } from '../core/models';
import { PointsStore } from './points.store';
import { Theme, UiService } from './ui.service';

export const STYLES: Record<Theme, string> = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};
const FONT = ['Montserrat Medium', 'Open Sans Bold'];
const DEFAULT_VIEW = { center: [-74.08, 4.6] as LngLat, zoom: 4.6 };

function pinElement(color: string, label: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pin';
  el.setAttribute('aria-label', label);
  el.style.setProperty('--pin', color);
  el.innerHTML = '<span class="pin-dot"></span>';
  return el;
}

/** Owns the MapLibre instance; renders store state as layers (clustered points, measure path). */
@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly store = inject(PointsStore);
  private readonly ui = inject(UiService);
  private map?: MlMap;
  private editMarker?: Marker;
  private editMarkerFor: string | null = null;
  private userMarker?: Marker;
  private currentTheme?: Theme;
  ready = false;

  constructor() {
    effect(() => {
      const pts = this.store.filtered();
      const sel = this.store.selectedId();
      this.render(pts, sel);
    });
    effect(() => this.renderMeasure(this.ui.measurePath()));
    effect(() => this.syncEditMarker(this.store.selected(), this.ui.draft()));
    effect(() => {
      const theme = this.ui.theme();
      if (this.map && this.currentTheme !== theme) {
        this.currentTheme = theme;
        this.map.setStyle(STYLES[theme]);
      }
    });
    effect(() => {
      const mode = this.ui.mode();
      const canvas = this.map?.getCanvas();
      if (canvas) canvas.style.cursor = mode === 'browse' ? '' : 'crosshair';
    });
  }

  init(container: HTMLElement): void {
    if (this.map) return;
    this.currentTheme = this.ui.theme();
    const points = this.store.points();
    this.map = new maplibregl.Map({
      container,
      style: STYLES[this.currentTheme],
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: false,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    this.map.on('style.load', () => {
      this.addLayers();
      this.ready = true;
      this.render(this.store.filtered(), this.store.selectedId());
      this.renderMeasure(this.ui.measurePath());
    });
    this.map.on('click', (e) => this.onClick(e));
    for (const layer of ['points', 'clusters']) {
      this.map.on('mouseenter', layer, () => this.setCursor('pointer'));
      this.map.on('mouseleave', layer, () => this.setCursor(this.ui.mode() === 'browse' ? '' : 'crosshair'));
    }
    if (points.length) this.map.once('load', () => this.fit(points, false));
    // expose for e2e tests
    (window as unknown as { __pointEditorMap?: MlMap }).__pointEditorMap = this.map;
  }

  destroy(): void {
    this.map?.remove();
    this.map = undefined;
    this.ready = false;
  }

  private setCursor(c: string): void {
    if (this.map) this.map.getCanvas().style.cursor = c;
  }

  private addLayers(): void {
    const map = this.map!;
    map.addSource('points', { type: 'geojson', data: this.collection([]), cluster: true, clusterRadius: 48, clusterMaxZoom: 13 });
    map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const dark = this.currentTheme === 'dark';
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'points',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#22d3ee', 10, '#818cf8', 50, '#6366f1'],
        'circle-radius': ['step', ['get', 'point_count'], 17, 10, 22, 50, 28],
        'circle-opacity': 0.88,
        'circle-stroke-width': 4,
        'circle-stroke-color': dark ? 'rgba(34,211,238,0.25)' : 'rgba(99,102,241,0.25)',
      },
    });
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'points',
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': FONT, 'text-size': 13 },
      paint: { 'text-color': '#070d18' },
    });
    map.addLayer({
      id: 'points',
      type: 'circle',
      source: 'points',
      filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'selected'], true]],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 6, 14, 9],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': dark ? '#070d18' : '#ffffff',
      },
    });
    map.addLayer({
      id: 'point-labels',
      type: 'symbol',
      source: 'points',
      filter: ['!', ['has', 'point_count']],
      minzoom: 5,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': FONT,
        'text-size': 12,
        'text-offset': [0, 1.3],
        'text-anchor': 'top',
        'text-max-width': 10,
        'text-optional': true,
      },
      paint: {
        'text-color': dark ? '#eef3fb' : '#10192b',
        'text-halo-color': dark ? '#070d18' : '#ffffff',
        'text-halo-width': 1.6,
      },
    });
    map.addLayer({
      id: 'measure-line',
      type: 'line',
      source: 'measure',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [2, 1.5] },
    });
    map.addLayer({
      id: 'measure-points',
      type: 'circle',
      source: 'measure',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-color': '#fbbf24', 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': '#070d18' },
    });
  }

  private collection(points: MapPoint[], selected: string | null = null): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        id: undefined,
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, name: p.name, color: p.color, selected: p.id === selected },
      })),
    };
  }

  private render(points: MapPoint[], selected: string | null): void {
    if (!this.ready) return;
    (this.map?.getSource('points') as GeoJSONSource | undefined)?.setData(this.collection(points, selected));
  }

  private renderMeasure(path: LngLat[]): void {
    if (!this.ready) return;
    const features: GeoJSON.Feature[] = path.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }));
    if (path.length > 1) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } });
    (this.map?.getSource('measure') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  }

  /** One draggable marker for the selected point or the draft being placed. */
  private syncEditMarker(selected: MapPoint | null, draft: { lng: number; lat: number } | null): void {
    if (!this.map) return;
    const target = selected ? { key: selected.id, lng: selected.lng, lat: selected.lat, color: selected.color, label: selected.name } : draft ? { key: 'draft', lng: draft.lng, lat: draft.lat, color: '#22d3ee', label: 'Nuevo punto' } : null;
    if (!target) {
      this.editMarker?.remove();
      this.editMarker = undefined;
      this.editMarkerFor = null;
      return;
    }
    if (this.editMarker && this.editMarkerFor === target.key) {
      this.editMarker.setLngLat([target.lng, target.lat]);
      this.editMarker.getElement().style.setProperty('--pin', target.color);
      return;
    }
    this.editMarker?.remove();
    this.editMarkerFor = target.key;
    const el = pinElement(target.color, `${target.label}: arrastra para mover`);
    this.editMarker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' }).setLngLat([target.lng, target.lat]).addTo(this.map);
    this.editMarker.on('dragend', () => {
      const { lng, lat } = this.editMarker!.getLngLat();
      if (this.editMarkerFor === 'draft') this.ui.draft.update((d) => (d ? { ...d, lng, lat } : d));
      else if (this.editMarkerFor) {
        this.store.update(this.editMarkerFor, { lng, lat });
        this.ui.toast('Punto movido', 'success', { label: 'Deshacer', run: () => this.store.undo() });
      }
    });
  }

  private onClick(e: MapMouseEvent): void {
    const map = this.map!;
    const mode = this.ui.mode();
    const lngLat: LngLat = [e.lngLat.lng, e.lngLat.lat];
    if (mode === 'measure') {
      this.ui.measurePath.update((p) => [...p, lngLat]);
      return;
    }
    const hits = map.queryRenderedFeatures(e.point, { layers: ['clusters', 'points'] });
    const hit = hits[0];
    if (hit?.layer.id === 'clusters') {
      const source = map.getSource('points') as GeoJSONSource;
      const clusterId = hit.properties['cluster_id'] as number;
      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: (hit.geometry as GeoJSON.Point).coordinates as LngLat, zoom: zoom + 0.5 });
      });
      return;
    }
    if (hit?.layer.id === 'points') {
      this.ui.draft.set(null);
      this.store.selectedId.set(hit.properties['id'] as string);
      return;
    }
    if (mode === 'add' || (!this.store.selectedId() && !this.ui.draft())) {
      this.store.selectedId.set(null);
      this.ui.draft.set({ lng: lngLat[0], lat: lngLat[1] });
      this.ui.panelOpen.set(true);
      return;
    }
    this.store.selectedId.set(null);
    this.ui.draft.set(null);
  }

  flyTo(lng: number, lat: number, zoom = 15): void {
    this.map?.flyTo({ center: [lng, lat], zoom: Math.max(zoom, this.map.getZoom()), speed: 1.6, essential: true });
  }

  fitBbox(bbox: [number, number, number, number]): void {
    this.map?.fitBounds(bbox, { padding: 60, maxZoom: 16, duration: 900 });
  }

  fit(points: MapPoint[] = this.store.filtered(), animate = true): void {
    if (!this.map || !points.length) return;
    if (points.length === 1) return this.flyTo(points[0].lng, points[0].lat, 14);
    const b = new LngLatBounds();
    points.forEach((p) => b.extend([p.lng, p.lat]));
    const mobile = window.innerWidth < 768;
    this.map.fitBounds(b, {
      padding: mobile ? { top: 90, bottom: 60, left: 40, right: 40 } : { top: 90, bottom: 60, left: 60, right: 60 },
      maxZoom: 15,
      duration: animate ? 900 : 0,
    });
  }

  center(): LngLat {
    const c = this.map?.getCenter();
    return c ? [c.lng, c.lat] : DEFAULT_VIEW.center;
  }

  showUser(lng: number, lat: number): void {
    if (!this.map) return;
    this.userMarker?.remove();
    const el = document.createElement('div');
    el.className = 'user-dot';
    el.setAttribute('aria-label', 'Tu ubicación');
    this.userMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map);
    this.flyTo(lng, lat, 15);
  }

  resize(): void {
    this.map?.resize();
  }
}
