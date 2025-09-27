import { Component, OnInit, OnDestroy, ElementRef, inject, viewChild, effect } from '@angular/core';
import { MapService } from '../../services/map.service';

@Component({
  selector: 'app-map',
  templateUrl: './map.html',
  styleUrl: './map.css',
  imports: [],
})
export class MapComponent implements OnInit, OnDestroy {
  public mapContainer = viewChild.required<ElementRef<HTMLElement>>('map');

  private readonly mapService = inject(MapService);

  ngOnInit(): void {
    this.mapService.initializeMap(this.mapContainer()?.nativeElement);
  }

  ngOnDestroy(): void {
    this.mapService.destroyMap();
  }
}
