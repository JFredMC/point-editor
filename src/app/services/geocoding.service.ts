import { Injectable } from '@angular/core';

export interface Place {
  name: string;
  label: string;
  lng: number;
  lat: number;
  bbox?: [number, number, number, number];
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1100;

/**
 * Place search with OpenStreetMap Nominatim (free, no key).
 * Usage policy: max 1 request/second, no autocomplete (only on explicit submit),
 * results cached, attribution shown in the UI.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly cache = new Map<string, Place[]>();
  private last = 0;

  async search(query: string, signal?: AbortSignal): Promise<Place[]> {
    const q = query.trim();
    if (q.length < 3) return [];
    const key = q.toLowerCase();
    const cached = this.cache.get(key);
    if (cached) return cached;

    const wait = this.last + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();

    const url = `${ENDPOINT}?format=jsonv2&limit=6&accept-language=es&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status === 429 ? 'Demasiadas búsquedas, espera un momento.' : 'No se pudo buscar el lugar.');
    const data = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string; boundingbox?: string[] }[];
    const places = data.map((d) => {
      const bb = d.boundingbox?.map(Number);
      return {
        name: d.name || d.display_name.split(',')[0],
        label: d.display_name,
        lng: Number(d.lon),
        lat: Number(d.lat),
        bbox: bb && bb.length === 4 ? ([bb[2], bb[0], bb[3], bb[1]] as [number, number, number, number]) : undefined,
      };
    });
    this.cache.set(key, places);
    return places;
  }
}
