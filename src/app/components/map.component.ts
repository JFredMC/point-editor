import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, viewChild } from '@angular/core';
import { MapService } from '../services/map.service';

@Component({
  selector: 'app-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="map" role="application" aria-label="Mapa interactivo. Haz clic para agregar un punto."></div>`,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly maps = inject(MapService);

  ngAfterViewInit(): void {
    this.maps.init(this.host().nativeElement);
  }

  ngOnDestroy(): void {
    this.maps.destroy();
  }
}
