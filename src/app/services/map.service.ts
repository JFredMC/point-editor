import { Injectable } from '@angular/core';
import { Map, NavigationControl } from 'maplibre-gl';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: Map | undefined;

  public initializeMap(
    container: HTMLElement,
    center: [number, number] = [-70.6483, -33.4569],
    zoom: number = 2
  ): void {
    if (this.map) return;

    this.map = new Map({
      container,
      style: 'https://demotiles.maplibre.org/globe.json',
      center,
      zoom,
      attributionControl: false,
    });

    this.map.addControl(new NavigationControl());
  }

  getMap(): Map | undefined {
    return this.map;
  }

  destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }
}