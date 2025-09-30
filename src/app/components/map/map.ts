import { Component, OnInit, OnDestroy, ElementRef, inject, viewChild } from '@angular/core';
import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-map',
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements OnInit, OnDestroy {
  // Reference to the map container using viewChild
  public mapContainer = viewChild.required<ElementRef<HTMLElement>>('map');

  // Injected services
  private readonly mapService = inject(MapService);

  /**
   * Initializes the map when loading the component
  */
  ngOnInit(): void {
    this.mapService.initializeMap(this.mapContainer().nativeElement);
  }

  ngOnDestroy(): void {
    this.mapService.destroyMap();
  }
}
