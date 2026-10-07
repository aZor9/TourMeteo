import { Injectable } from '@angular/core';
import { FeatureFlagService } from './feature-flag.service';

const STORAGE_KEY = 'tourmeteo_recent_cities';
const MAX_RECENT = 10;

@Injectable({ providedIn: 'root' })
export class RecentCitiesService {

  private cities: string[] = [];

  constructor(private featureFlags: FeatureFlagService) {
    this.load();
  }

  /** Whether the feature is enabled */
  get enabled(): boolean { return this.featureFlags.isEnabled('recentCities'); }

  /** Get all recent cities (most recent first) */
  getAll(): string[] {
    if (!this.enabled) return [];
    return [...this.cities];
  }

  /** Filter recent cities matching a prefix (case-insensitive) */
  search(query: string): string[] {
    if (!this.enabled) return [];
    if (!query || !query.trim()) return this.cities;
    const q = query.trim().toLowerCase();
    return this.cities.filter(c => c.toLowerCase().includes(q));
  }

  /** Add a city to the recent list (moves to top if already exists) */
  add(city: string): void {
    if (!this.enabled) return;
    const name = city.trim();
    if (!name) return;
    // Remove duplicates (case-insensitive)
    this.cities = this.cities.filter(c => c.toLowerCase() !== name.toLowerCase());
    // Prepend
    this.cities.unshift(name);
    // Trim to max
    if (this.cities.length > MAX_RECENT) this.cities = this.cities.slice(0, MAX_RECENT);
    this.persist();
  }

  /** Add multiple cities (from comma-separated input) */
  addMultiple(raw: string): void {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      this.add(part);
    }
  }

  /** Remove a specific city */
  remove(city: string): void {
    this.cities = this.cities.filter(c => c.toLowerCase() !== city.toLowerCase());
    this.persist();
  }

  /** Clear all */
  clear(): void {
    this.cities = [];
    this.persist();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cities = parsed.filter((c: any) => typeof c === 'string').slice(0, MAX_RECENT);
        }
      }
    } catch {
      this.cities = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cities));
    } catch { /* quota exceeded — silent */ }
  }
}
