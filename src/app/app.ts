import { ChangeDetectionStrategy, Component, computed, effect, inject, viewChild } from '@angular/core';
import { formatDistance } from './core/geo';
import { EditorComponent } from './components/editor.component';
import { MapComponent } from './components/map.component';
import { SearchComponent } from './components/search.component';
import { SidebarComponent } from './components/sidebar.component';
import { MapService } from './services/map.service';
import { PointsStore } from './services/points.store';
import { UiService } from './services/ui.service';

const SHORTCUTS: [string, string][] = [
  ['A', 'Modo agregar punto'],
  ['N', 'Nuevo punto en el centro del mapa'],
  ['M', 'Medir distancias'],
  ['L', 'Ir a mi ubicación'],
  ['F', 'Encuadrar todos los puntos'],
  ['/', 'Buscar un lugar'],
  ['D', 'Cambiar tema claro/oscuro'],
  ['Ctrl + Z', 'Deshacer'],
  ['Ctrl + Shift + Z / Ctrl + Y', 'Rehacer'],
  ['Supr', 'Eliminar el punto seleccionado'],
  ['Esc', 'Cancelar / cerrar'],
  ['?', 'Mostrar esta ayuda'],
];

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapComponent, SidebarComponent, EditorComponent, SearchComponent],
  templateUrl: './app.html',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class App {
  protected readonly store = inject(PointsStore);
  protected readonly ui = inject(UiService);
  private readonly maps = inject(MapService);
  private readonly search = viewChild.required(SearchComponent);
  protected readonly shortcuts = SHORTCUTS;
  protected readonly editing = computed(() => !!this.store.selected() || !!this.ui.draft());
  protected readonly measureLabel = computed(() => formatDistance(this.ui.measureTotal()));
  protected readonly isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  constructor() {
    effect(() => {
      if (this.store.selected()) this.ui.panelOpen.set(true);
    });
  }

  newAtCenter(): void {
    const [lng, lat] = this.maps.center();
    this.ui.mode.set('browse');
    this.store.selectedId.set(null);
    this.ui.draft.set({ lng, lat });
    this.ui.panelOpen.set(true);
  }

  fit(): void {
    if (!this.store.filtered().length) {
      this.ui.toast('Aún no hay puntos para encuadrar.');
      return;
    }
    this.maps.fit();
  }

  locate(): void {
    if (!('geolocation' in navigator)) {
      this.ui.toast('Tu navegador no permite geolocalización.', 'error');
      return;
    }
    this.ui.toast('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        this.ui.userLocation.set([longitude, latitude]);
        this.maps.showUser(longitude, latitude);
        this.ui.toast('Te encontramos. La lista ahora se ordena por cercanía.', 'success', {
          label: 'Agregar aquí',
          run: () => {
            this.store.selectedId.set(null);
            this.ui.draft.set({ lng: longitude, lat: latitude, name: 'Mi ubicación' });
            this.ui.panelOpen.set(true);
          },
        });
      },
      (err) => this.ui.toast(err.code === err.PERMISSION_DENIED ? 'Permiso de ubicación denegado.' : 'No se pudo obtener tu ubicación.', 'error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  undo(): void {
    if (this.store.undo()) this.ui.toast('Deshecho');
  }

  redo(): void {
    if (this.store.redo()) this.ui.toast('Rehecho');
  }

  undoMeasure(): void {
    this.ui.measurePath.update((p) => p.slice(0, -1));
  }

  togglePanel(): void {
    this.ui.panelOpen.update((o) => !o);
    setTimeout(() => this.maps.resize(), 260);
  }

  onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    const typing = t.closest('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'z' && !typing) {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && key === 'y' && !typing) {
      e.preventDefault();
      this.redo();
      return;
    }
    if (e.key === 'Escape') {
      if (this.ui.helpOpen()) this.ui.helpOpen.set(false);
      else if (this.ui.mode() !== 'browse') this.ui.setMode('browse');
      else if (this.editing()) {
        this.store.selectedId.set(null);
        this.ui.draft.set(null);
      }
      return;
    }
    if (typing || mod || e.altKey) return;
    switch (e.key) {
      case '/':
        e.preventDefault();
        this.search().focus();
        break;
      case '?':
        this.ui.helpOpen.update((v) => !v);
        break;
      case 'a':
      case 'A':
        this.ui.setMode('add');
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        this.newAtCenter();
        break;
      case 'm':
      case 'M':
        this.ui.setMode('measure');
        break;
      case 'l':
      case 'L':
        this.locate();
        break;
      case 'f':
      case 'F':
        this.fit();
        break;
      case 'd':
      case 'D':
        this.ui.toggleTheme();
        break;
      case 'Delete':
      case 'Backspace': {
        const p = this.store.selected();
        if (p) {
          this.store.remove(p.id);
          this.ui.toast(`«${p.name}» eliminado`, 'info', { label: 'Deshacer', run: () => this.store.undo() });
        }
        break;
      }
    }
  }
}
