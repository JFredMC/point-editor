import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { formatCoords } from '../core/geo';
import { DEFAULT_COLOR, POINT_COLORS } from '../core/models';
import { MapService } from '../services/map.service';
import { PointsStore } from '../services/points.store';
import { UiService } from '../services/ui.service';

@Component({
  selector: 'app-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="editor" (submit)="save($event)" aria-labelledby="editor-title">
      <header class="editor-head">
        <button type="button" class="icon-btn" (click)="cancel()" aria-label="Volver a la lista"><i class="bi bi-arrow-left"></i></button>
        <h2 id="editor-title">{{ isNew() ? 'Nuevo punto' : 'Editar punto' }}</h2>
        @if (!isNew()) {
          <button type="button" class="icon-btn danger" (click)="remove()" aria-label="Eliminar punto" title="Eliminar (Supr)"><i class="bi bi-trash3"></i></button>
        }
      </header>

      <label class="field">
        <span>Nombre <em aria-hidden="true">*</em></span>
        <input #nameInput name="name" required maxlength="80" [value]="name()" (input)="name.set(nameInput.value)" placeholder="Ej. Café del parque" [attr.aria-invalid]="touched() && !valid()" />
        @if (touched() && !valid()) {
          <small class="error">Ponle un nombre al punto.</small>
        }
      </label>

      <label class="field">
        <span>Descripción</span>
        <textarea #descInput name="description" rows="3" maxlength="500" [value]="description()" (input)="description.set(descInput.value)" placeholder="Notas, horario, referencias…"></textarea>
      </label>

      <label class="field">
        <span>Categoría</span>
        <input #catInput name="category" maxlength="40" list="category-options" [value]="category()" (input)="category.set(catInput.value)" placeholder="Ej. Restaurante" />
        <datalist id="category-options">
          @for (c of store.categories(); track c.name) {
            <option [value]="c.name"></option>
          }
        </datalist>
      </label>

      <fieldset class="field">
        <legend>Color</legend>
        <div class="swatches">
          @for (c of colors; track c) {
            <button type="button" class="swatch" [style.--sw]="c" [class.on]="c === color()" [attr.aria-pressed]="c === color()" [attr.aria-label]="'Color ' + c" (click)="color.set(c)"></button>
          }
          <label class="swatch custom" title="Color personalizado">
            <input #colorInput type="color" [value]="color()" (input)="color.set(colorInput.value)" aria-label="Color personalizado" />
            <i class="bi bi-eyedropper" aria-hidden="true"></i>
          </label>
        </div>
      </fieldset>

      <div class="coords">
        <i class="bi bi-crosshair" aria-hidden="true"></i>
        <span>{{ coords() }}</span>
        <button type="button" class="link" (click)="copy()">Copiar</button>
        <button type="button" class="link" (click)="center()">Centrar</button>
      </div>
      <p class="tip"><i class="bi bi-arrows-move" aria-hidden="true"></i> Arrastra el marcador en el mapa para moverlo.</p>

      <div class="actions">
        <button type="button" class="btn ghost" (click)="cancel()">Cancelar</button>
        <button type="submit" class="btn primary"><i class="bi bi-check2"></i> {{ isNew() ? 'Agregar punto' : 'Guardar cambios' }}</button>
      </div>
    </form>
  `,
})
export class EditorComponent {
  protected readonly store = inject(PointsStore);
  private readonly ui = inject(UiService);
  private readonly maps = inject(MapService);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  protected readonly colors = POINT_COLORS;

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly category = signal('');
  protected readonly color = signal<string>(DEFAULT_COLOR);
  protected readonly touched = signal(false);

  protected readonly isNew = computed(() => !this.store.selected());
  private readonly target = computed(() => this.store.selected()?.id ?? (this.ui.draft() ? 'draft' : null));
  protected readonly valid = computed(() => this.name().trim().length > 0);
  protected readonly coords = computed(() => {
    const p = this.store.selected() ?? this.ui.draft();
    return p ? formatCoords(p.lng, p.lat) : '';
  });

  constructor() {
    effect(() => {
      this.target();
      untracked(() => {
        const p = this.store.selected();
        const d = this.ui.draft();
        this.name.set(p?.name ?? d?.name ?? '');
        this.description.set(p?.description ?? '');
        this.category.set(p?.category ?? (this.store.categoryFilter() || ''));
        this.color.set(p?.color ?? DEFAULT_COLOR);
        this.touched.set(false);
        if (!p) setTimeout(() => this.nameInput()?.nativeElement.focus({ preventScroll: true }), 50);
      });
    });
  }

  save(e: Event): void {
    e.preventDefault();
    this.touched.set(true);
    if (!this.valid()) {
      this.nameInput()?.nativeElement.focus();
      return;
    }
    const values = { name: this.name().trim(), description: this.description().trim(), category: this.category().trim(), color: this.color() };
    const selected = this.store.selected();
    if (selected) {
      this.store.update(selected.id, values);
      this.store.selectedId.set(null);
      this.ui.toast('Cambios guardados', 'success');
    } else {
      const d = this.ui.draft();
      if (!d) return;
      this.store.add({ ...values, lng: d.lng, lat: d.lat });
      this.ui.draft.set(null);
      this.ui.toast(`«${values.name}» agregado`, 'success', { label: 'Deshacer', run: () => this.store.undo() });
    }
  }

  cancel(): void {
    this.store.selectedId.set(null);
    this.ui.draft.set(null);
  }

  remove(): void {
    const p = this.store.selected();
    if (!p) return;
    this.store.remove(p.id);
    this.ui.toast(`«${p.name}» eliminado`, 'info', { label: 'Deshacer', run: () => this.store.undo() });
  }

  center(): void {
    const p = this.store.selected() ?? this.ui.draft();
    if (p) this.maps.flyTo(p.lng, p.lat, 15);
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.coords());
      this.ui.toast('Coordenadas copiadas', 'success');
    } catch {
      this.ui.toast('No se pudo copiar', 'error');
    }
  }
}
