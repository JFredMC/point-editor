import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { GeocodingService, Place } from '../services/geocoding.service';
import { MapService } from '../services/map.service';
import { PointsStore } from '../services/points.store';
import { UiService } from '../services/ui.service';

@Component({
  selector: 'app-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="search" role="search" (submit)="submit($event)">
      <i class="bi bi-search" aria-hidden="true"></i>
      <input
        #input
        type="search"
        name="q"
        autocomplete="off"
        placeholder="Buscar un lugar…"
        aria-label="Buscar un lugar en el mapa"
        [value]="q()"
        (input)="q.set(input.value)"
        (keydown.escape)="close(); input.blur()"
        (keydown.arrowdown)="move(1, $event)"
        (keydown.arrowup)="move(-1, $event)"
      />
      @if (loading()) {
        <span class="spinner" aria-label="Buscando"></span>
      } @else {
        <kbd class="hint" aria-hidden="true">/</kbd>
      }
    </form>
    @if (open()) {
      <div class="search-results" role="listbox" aria-label="Resultados de búsqueda">
        @for (p of results(); track p.label; let i = $index) {
          <button type="button" role="option" class="result" [class.active]="i === active()" [attr.aria-selected]="i === active()" (click)="choose(p)">
            <i class="bi bi-geo-alt" aria-hidden="true"></i>
            <span><strong>{{ p.name }}</strong><small>{{ p.label }}</small></span>
          </button>
        } @empty {
          <p class="result-empty">{{ error() || 'Sin resultados para «' + q() + '».' }}</p>
        }
        <p class="result-credit">Búsqueda: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · Nominatim</p>
      </div>
    }
  `,
  host: { class: 'search-wrap', '(document:click)': 'outside($event)' },
})
export class SearchComponent {
  private readonly geo = inject(GeocodingService);
  private readonly maps = inject(MapService);
  private readonly store = inject(PointsStore);
  private readonly ui = inject(UiService);
  private readonly el = inject(ElementRef<HTMLElement>);
  readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  readonly q = signal('');
  readonly results = signal<Place[]>([]);
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly active = signal(0);
  private abort?: AbortController;

  focus(): void {
    this.input().nativeElement.focus();
    this.input().nativeElement.select();
  }

  async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.open() && this.results()[this.active()]) return this.choose(this.results()[this.active()]);
    const q = this.q().trim();
    if (q.length < 3) {
      this.ui.toast('Escribe al menos 3 letras para buscar.');
      return;
    }
    this.abort?.abort();
    this.abort = new AbortController();
    this.loading.set(true);
    this.error.set('');
    try {
      this.results.set(await this.geo.search(q, this.abort.signal));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      this.results.set([]);
      this.error.set((err as Error).message || 'No se pudo buscar el lugar.');
    } finally {
      this.loading.set(false);
    }
    this.active.set(0);
    this.open.set(true);
  }

  move(delta: number, e: Event): void {
    if (!this.open() || !this.results().length) return;
    e.preventDefault();
    const n = this.results().length;
    this.active.update((i) => (i + delta + n) % n);
  }

  choose(p: Place): void {
    this.open.set(false);
    if (p.bbox) this.maps.fitBbox(p.bbox);
    else this.maps.flyTo(p.lng, p.lat, 15);
    this.store.selectedId.set(null);
    this.ui.setMode('browse');
    this.ui.draft.set({ lng: p.lng, lat: p.lat, name: p.name });
    this.ui.panelOpen.set(true);
  }

  close(): void {
    this.open.set(false);
  }

  outside(e: Event): void {
    if (!this.el.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
