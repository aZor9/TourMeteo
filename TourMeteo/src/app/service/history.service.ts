import { Injectable } from '@angular/core';
import { Passage, PassageWeather } from '../models/passage.model';

/** Shape stored in localStorage (Date serialised as ISO string) */
export interface SavedRoute {
  id: string;
  fileName: string;
  displayDate: string;
  savedAt: string;            // ISO
  totalDistanceKm: number;
  durationText: string;
  departureTime: string;
  arrivalTime: string;
  avgSpeed: number;
  departure: string;          // datetime-local value
  cityCount: number;
  /** Points stored as compact arrays to save space */
  points: Array<{ lat: number; lon: number }>;
  /** Passages with time stored as ISO */
  passages: Array<{
    city: string;
    lat: number;
    lon: number;
    time: string;
    distanceKm: number;
    status: 'pending' | 'ok' | 'error';
    message?: string;
    weather?: PassageWeather;
  }>;
}

const STORAGE_KEY = 'tourmeteo_history';
const MAX_ITEMS = 30;

@Injectable({ providedIn: 'root' })
export class HistoryService {

  // ─── Read ───

  getAll(): SavedRoute[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as SavedRoute[];
      return arr.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    } catch {
      return [];
    }
  }

  getById(id: string): SavedRoute | null {
    return this.getAll().find(r => r.id === id) ?? null;
  }

  // ─── Write ───

  save(route: SavedRoute): { ok: boolean; error?: string } {
    const list = this.getAll();

    // Replace if same id already exists
    const idx = list.findIndex(r => r.id === route.id);
    if (idx >= 0) list[idx] = route;
    else list.unshift(route);

    // Enforce max
    while (list.length > MAX_ITEMS) list.pop();

    return this.persist(list);
  }

  remove(id: string): void {
    const list = this.getAll().filter(r => r.id !== id);
    this.persist(list);
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ─── Storage info ───

  /** Returns { usedKB, totalKB, percent, count } */
  getStorageInfo(): { usedKB: number; totalKB: number; percent: number; count: number } {
    const raw = localStorage.getItem(STORAGE_KEY) || '';
    const usedBytes = new Blob([raw]).size;
    const usedKB = +(usedBytes / 1024).toFixed(1);
    // Most browsers allow ~5 MB per origin
    const totalKB = 5120;
    return { usedKB, totalKB, percent: +(usedKB / totalKB * 100).toFixed(1), count: this.getAll().length };
  }

  isNearlyFull(): boolean {
    return this.getStorageInfo().percent > 80;
  }

  // ─── Helpers ───

  /** Convert live Passage[] → serialisable passages */
  static serialisePassages(passages: Passage[]): SavedRoute['passages'] {
    return passages.map(p => ({
      city: p.city,
      lat: p.lat,
      lon: p.lon,
      time: p.time.toISOString(),
      distanceKm: p.distanceKm,
      status: p.status,
      message: p.message,
      weather: p.weather
    }));
  }

  /** Convert stored passages → live Passage[] (restore Date objects) */
  static deserialisePassages(stored: SavedRoute['passages']): Passage[] {
    return stored.map(s => ({
      ...s,
      time: new Date(s.time)
    }));
  }

  /** Generate a stable id from fileName + departure */
  static makeId(fileName: string, departure: string): string {
    return `${fileName}_${departure}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  // ─── Private ───

  private persist(list: SavedRoute[]): { ok: boolean; error?: string } {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return { ok: true };
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        return { ok: false, error: 'Stockage local plein ! Supprimez des anciens trajets.' };
      }
      return { ok: false, error: e?.message || 'Erreur localStorage' };
    }
  }
}
