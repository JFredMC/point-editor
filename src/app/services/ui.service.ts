import { computed, effect, Injectable, signal } from '@angular/core';
import { LngLat } from '../core/models';
import { pathLength } from '../core/geo';

export type Theme = 'dark' | 'light';
export type Mode = 'browse' | 'add' | 'measure';
export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

const THEME_KEY = 'point-editor:theme';

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly theme = signal<Theme>(this.initialTheme());
  readonly mode = signal<Mode>('browse');
  readonly panelOpen = signal(false);
  readonly helpOpen = signal(false);
  readonly toasts = signal<Toast[]>([]);
  /** New point being placed (not saved yet). */
  readonly draft = signal<{ lng: number; lat: number; name?: string } | null>(null);
  readonly measurePath = signal<LngLat[]>([]);
  readonly measureTotal = computed(() => pathLength(this.measurePath()));
  readonly userLocation = signal<LngLat | null>(null);
  private seq = 0;

  constructor() {
    effect(() => {
      const theme = this.theme();
      document.documentElement.dataset['theme'] = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070d18' : '#f5f8fc');
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        /* ignore */
      }
    });
  }

  private initialTheme(): Theme {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  setMode(mode: Mode): void {
    const next = this.mode() === mode ? 'browse' : mode;
    this.mode.set(next);
    if (next !== 'measure') this.measurePath.set([]);
    if (next !== 'browse' && window.innerWidth < 768) this.panelOpen.set(false);
  }

  toast(text: string, kind: Toast['kind'] = 'info', action?: Toast['action']): void {
    const id = ++this.seq;
    this.toasts.update((t) => [...t.slice(-2), { id, text, kind, action }]);
    setTimeout(() => this.dismiss(id), action ? 6000 : 3500);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
