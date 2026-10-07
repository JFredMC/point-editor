import { computed, effect, Injectable, signal } from '@angular/core';
import { History } from '../core/history';
import { newId } from '../core/id';
import { DEFAULT_COLOR, MapPoint, PointDraft } from '../core/models';
import { parseGeoJSON } from '../core/io';

export const STORAGE_KEY = 'point-editor:v2';
const LEGACY_KEY = 'poi_editor_state';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

@Injectable({ providedIn: 'root' })
export class PointsStore {
  private readonly history = new History<MapPoint[]>();
  private readonly _points = signal<MapPoint[]>(this.load());
  private readonly _version = signal(0);

  readonly points = this._points.asReadonly();
  readonly selectedId = signal<string | null>(null);
  readonly query = signal('');
  readonly categoryFilter = signal<string | null>(null);

  readonly selected = computed(() => this._points().find((p) => p.id === this.selectedId()) ?? null);
  readonly canUndo = computed(() => (this._version(), this.history.canUndo));
  readonly canRedo = computed(() => (this._version(), this.history.canRedo));

  readonly categories = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this._points()) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([name, count]) => ({ name, count }));
  });

  readonly filtered = computed(() => {
    const q = normalize(this.query());
    const cat = this.categoryFilter();
    return this._points().filter(
      (p) =>
        (!cat || p.category === cat) &&
        (!q || normalize(p.name).includes(q) || normalize(p.description).includes(q) || normalize(p.category).includes(q)),
    );
  });

  constructor() {
    effect(() => {
      const points = this._points();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
      } catch {
        /* storage full or disabled: keep working in memory */
      }
    });
  }

  private load(): MapPoint[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((p) => p && typeof p.id === 'string' && typeof p.lng === 'number');
      }
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) return parseGeoJSON(legacy).points;
    } catch {
      /* corrupted storage: start empty */
    }
    return [];
  }

  private commit(next: MapPoint[]): void {
    this.history.record(this._points());
    this._points.set(next);
    this._version.update((v) => v + 1);
    if (this.selectedId() && !next.some((p) => p.id === this.selectedId())) this.selectedId.set(null);
  }

  add(draft: PointDraft): MapPoint {
    const now = new Date().toISOString();
    const point: MapPoint = { ...draft, color: draft.color || DEFAULT_COLOR, id: newId(), createdAt: now, updatedAt: now };
    this.commit([...this._points(), point]);
    return point;
  }

  addMany(points: MapPoint[]): void {
    if (!points.length) return;
    const ids = new Set(this._points().map((p) => p.id));
    const fresh = points.map((p) => (ids.has(p.id) ? { ...p, id: newId() } : p));
    this.commit([...this._points(), ...fresh]);
  }

  addSamples(drafts: PointDraft[]): void {
    const now = new Date().toISOString();
    this.addMany(drafts.map((d) => ({ ...d, id: newId(), createdAt: now, updatedAt: now })));
  }

  update(id: string, changes: Partial<PointDraft>): void {
    const current = this._points().find((p) => p.id === id);
    if (!current) return;
    const changed = (Object.keys(changes) as (keyof PointDraft)[]).some((k) => changes[k] !== current[k]);
    if (!changed) return;
    this.commit(this._points().map((p) => (p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p)));
  }

  remove(id: string): void {
    this.commit(this._points().filter((p) => p.id !== id));
  }

  clear(): void {
    if (this._points().length) this.commit([]);
  }

  undo(): boolean {
    const prev = this.history.undo(this._points());
    if (prev === undefined) return false;
    this._points.set(prev);
    this._version.update((v) => v + 1);
    return true;
  }

  redo(): boolean {
    const next = this.history.redo(this._points());
    if (next === undefined) return false;
    this._points.set(next);
    this._version.update((v) => v + 1);
    return true;
  }
}
