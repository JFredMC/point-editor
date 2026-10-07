import { TestBed } from '@angular/core/testing';
import { PointsStore, STORAGE_KEY } from './points.store';

const draft = { name: 'Café Ñuñoa', description: 'Buen café', category: 'Comida', color: '#22d3ee', lng: -74, lat: 4.6 };

describe('PointsStore', () => {
  beforeEach(() => localStorage.clear());

  const create = () => TestBed.inject(PointsStore);

  it('adds, updates and removes points with undo/redo', () => {
    const store = create();
    const p = store.add(draft);
    expect(store.points().length).toBe(1);
    store.update(p.id, { name: 'Nuevo' });
    expect(store.points()[0].name).toBe('Nuevo');
    expect(store.canUndo()).toBe(true);
    store.undo();
    expect(store.points()[0].name).toBe('Café Ñuñoa');
    store.redo();
    expect(store.points()[0].name).toBe('Nuevo');
    store.selectedId.set(p.id);
    store.remove(p.id);
    expect(store.points().length).toBe(0);
    expect(store.selectedId()).toBeNull();
    store.undo();
    expect(store.points().length).toBe(1);
  });

  it('ignores updates without changes', () => {
    const store = create();
    const p = store.add(draft);
    store.undo();
    store.redo();
    store.update(p.id, { name: draft.name });
    store.undo();
    expect(store.points().length).toBe(0);
  });

  it('filters by accent-insensitive text and category', () => {
    const store = create();
    store.add(draft);
    store.add({ ...draft, name: 'Museo', category: 'Cultura' });
    store.query.set('nunoa');
    expect(store.filtered().map((p) => p.name)).toEqual(['Café Ñuñoa']);
    store.query.set('');
    store.categoryFilter.set('Cultura');
    expect(store.filtered().map((p) => p.name)).toEqual(['Museo']);
    expect(store.categories()).toEqual([
      { name: 'Comida', count: 1 },
      { name: 'Cultura', count: 1 },
    ]);
  });

  it('persists to localStorage and migrates the legacy format', () => {
    const store = create();
    store.add(draft);
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].name).toBe('Café Ñuñoa');

    TestBed.resetTestingModule();
    localStorage.clear();
    localStorage.setItem(
      'poi_editor_state',
      JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 'f1', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { name: 'Viejo', category: 'X' } }] }),
    );
    expect(TestBed.inject(PointsStore).points()[0]).toMatchObject({ id: 'f1', name: 'Viejo' });
  });
});
