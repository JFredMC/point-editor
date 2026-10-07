import { History } from './history';

describe('History', () => {
  it('undoes and redoes snapshots', () => {
    const h = new History<number>();
    h.record(1);
    h.record(2);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.redo(1)).toBe(2);
    expect(h.redo(2)).toBe(3);
    expect(h.canRedo).toBe(false);
  });

  it('clears the redo stack on a new change and respects the limit', () => {
    const h = new History<number>(2);
    h.record(1);
    h.record(2);
    h.record(3);
    expect(h.undo(4)).toBe(3);
    h.record(9);
    expect(h.canRedo).toBe(false);
    expect(h.undo(10)).toBe(9);
    expect(h.undo(9)).toBe(2);
    expect(h.undo(2)).toBeUndefined();
  });
});
