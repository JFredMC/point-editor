import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { download, stamp } from '../core/download';
import { formatDistance, haversine } from '../core/geo';
import { detectFormat, parseCSV, parseGeoJSON, toCSV, toGeoJSON } from '../core/io';
import { MapPoint } from '../core/models';
import { SAMPLE_POINTS } from '../core/samples';
import { MapService } from '../services/map.service';
import { PointsStore } from '../services/points.store';
import { UiService } from '../services/ui.service';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="list" aria-labelledby="list-title">
      <header class="list-head">
        <h2 id="list-title">Mis puntos <span class="count">{{ store.points().length }}</span></h2>
        <div class="menu-wrap">
          <button type="button" class="icon-btn" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-haspopup="menu" aria-label="Importar y exportar"><i class="bi bi-three-dots"></i></button>
          @if (menu()) {
            <div class="menu" role="menu">
              <button role="menuitem" type="button" (click)="file.click(); menu.set(false)"><i class="bi bi-upload"></i> Importar GeoJSON o CSV</button>
              <button role="menuitem" type="button" [disabled]="!store.points().length" (click)="exportAs('geojson')"><i class="bi bi-filetype-json"></i> Exportar GeoJSON</button>
              <button role="menuitem" type="button" [disabled]="!store.points().length" (click)="exportAs('csv')"><i class="bi bi-filetype-csv"></i> Exportar CSV</button>
              <hr />
              <button role="menuitem" type="button" (click)="samples()"><i class="bi bi-stars"></i> Cargar ejemplos</button>
              <button role="menuitem" type="button" class="danger" [disabled]="!store.points().length" (click)="clearAll()"><i class="bi bi-trash3"></i> Borrar todo</button>
            </div>
          }
        </div>
        <input #file type="file" accept=".geojson,.json,.csv,application/geo+json,text/csv" hidden (change)="onFile(file)" />
      </header>

      @if (store.points().length) {
        <div class="filter">
          <i class="bi bi-funnel" aria-hidden="true"></i>
          <input #filter type="search" placeholder="Filtrar mis puntos" aria-label="Filtrar mis puntos por nombre, descripción o categoría" [value]="store.query()" (input)="store.query.set(filter.value)" />
        </div>
        @if (store.categories().length) {
          <div class="chips" role="group" aria-label="Filtrar por categoría">
            <button type="button" class="chip" [class.on]="!store.categoryFilter()" (click)="store.categoryFilter.set(null)">Todas</button>
            @for (c of store.categories(); track c.name) {
              <button type="button" class="chip" [class.on]="store.categoryFilter() === c.name" [attr.aria-pressed]="store.categoryFilter() === c.name" (click)="toggleCat(c.name)">{{ c.name }} <span>{{ c.count }}</span></button>
            }
          </div>
        }
        @if (sorted().length) {
          <ul class="items">
            @for (p of sorted(); track p.id) {
              <li>
                <button type="button" class="item" [class.on]="p.id === store.selectedId()" (click)="open(p)">
                  <span class="dot" [style.background]="p.color" aria-hidden="true"></span>
                  <span class="item-text">
                    <strong>{{ p.name }}</strong>
                    <small>{{ p.category || 'Sin categoría' }}@if (distances().get(p.id); as d) { · a {{ d }} }</small>
                  </span>
                  <i class="bi bi-chevron-right" aria-hidden="true"></i>
                </button>
              </li>
            }
          </ul>
          @if (store.filtered().length !== store.points().length) {
            <p class="muted small center">Mostrando {{ store.filtered().length }} de {{ store.points().length }} · <button type="button" class="link" (click)="resetFilters()">Quitar filtros</button></p>
          }
        } @else {
          <div class="empty">
            <i class="bi bi-search" aria-hidden="true"></i>
            <p>Ningún punto coincide con el filtro.</p>
            <button type="button" class="btn ghost" (click)="resetFilters()">Quitar filtros</button>
          </div>
        }
      } @else {
        <div class="empty">
          <div class="empty-art" aria-hidden="true"><i class="bi bi-pin-map"></i></div>
          <h3>Tu mapa está vacío</h3>
          <p>Haz clic en cualquier lugar del mapa para agregar tu primer punto, busca una dirección o importa un archivo.</p>
          <div class="empty-actions">
            <button type="button" class="btn primary" (click)="samples()"><i class="bi bi-stars"></i> Cargar ejemplos</button>
            <button type="button" class="btn ghost" (click)="file.click()"><i class="bi bi-upload"></i> Importar</button>
          </div>
        </div>
      }
    </section>
  `,
  host: { '(document:click)': 'outside($event)' },
})
export class SidebarComponent {
  protected readonly store = inject(PointsStore);
  private readonly ui = inject(UiService);
  private readonly maps = inject(MapService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly fileRef = viewChild.required<ElementRef<HTMLInputElement>>('file');
  protected readonly menu = signal(false);

  protected readonly distances = computed(() => {
    const me = this.ui.userLocation();
    const out = new Map<string, string>();
    if (me) for (const p of this.store.filtered()) out.set(p.id, formatDistance(haversine(me, [p.lng, p.lat])));
    return out;
  });

  protected readonly sorted = computed(() => {
    const me = this.ui.userLocation();
    const list = [...this.store.filtered()];
    if (me) return list.sort((a, b) => haversine(me, [a.lng, a.lat]) - haversine(me, [b.lng, b.lat]));
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  open(p: MapPoint): void {
    this.ui.draft.set(null);
    this.store.selectedId.set(p.id);
    this.maps.flyTo(p.lng, p.lat, 14);
  }

  toggleCat(name: string): void {
    this.store.categoryFilter.update((c) => (c === name ? null : name));
  }

  resetFilters(): void {
    this.store.query.set('');
    this.store.categoryFilter.set(null);
  }

  samples(): void {
    this.menu.set(false);
    this.store.addSamples(SAMPLE_POINTS);
    this.ui.toast(`${SAMPLE_POINTS.length} puntos de ejemplo cargados`, 'success', { label: 'Deshacer', run: () => this.store.undo() });
    setTimeout(() => this.maps.fit(this.store.points()), 50);
  }

  exportAs(kind: 'geojson' | 'csv'): void {
    this.menu.set(false);
    const pts = this.store.points();
    if (kind === 'geojson') download(toGeoJSON(pts), `puntos-${stamp()}.geojson`, 'application/geo+json');
    else download('\uFEFF' + toCSV(pts), `puntos-${stamp()}.csv`, 'text/csv;charset=utf-8');
    this.ui.toast(`${pts.length} puntos exportados en ${kind === 'csv' ? 'CSV' : 'GeoJSON'}`, 'success');
  }

  clearAll(): void {
    this.menu.set(false);
    const n = this.store.points().length;
    this.store.clear();
    this.resetFilters();
    this.ui.toast(`Se borraron ${n} puntos`, 'info', { label: 'Deshacer', run: () => this.store.undo() });
  }

  async onFile(input: HTMLInputElement): Promise<void> {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      this.ui.toast('El archivo supera 5 MB.', 'error');
      return;
    }
    try {
      const text = await f.text();
      const result = detectFormat(f.name, text) === 'csv' ? parseCSV(text) : parseGeoJSON(text);
      if (!result.points.length) {
        this.ui.toast('El archivo no tiene puntos válidos.', 'error');
        return;
      }
      this.store.addMany(result.points);
      const extra = result.discarded ? `, ${result.discarded} descartados` : '';
      this.ui.toast(`${result.points.length} puntos importados${extra}`, 'success', { label: 'Deshacer', run: () => this.store.undo() });
      setTimeout(() => this.maps.fit(result.points), 50);
    } catch (err) {
      this.ui.toast((err as Error).message || 'No se pudo leer el archivo.', 'error');
    }
  }

  openFilePicker(): void {
    this.fileRef().nativeElement.click();
  }

  outside(e: Event): void {
    if (this.menu() && !(this.host.nativeElement.querySelector('.menu-wrap') as HTMLElement)?.contains(e.target as Node)) this.menu.set(false);
  }
}
