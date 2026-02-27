import { Injectable } from '@angular/core';

const STORAGE_KEY = 'tourmeteo_flags';

export interface FeatureFlags {
  /** Show history panel + save/load routes */
  history: boolean;
  /** Show special features: map, refresh weather, etc. */
  experimental: boolean;
}

const DEFAULTS: FeatureFlags = {
  history: false,
  experimental: false
};

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {

  private flags: FeatureFlags = { ...DEFAULTS };

  constructor() {
    this.load();
  }

  /** Check if a flag is enabled */
  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag];
  }

  /** Toggle a flag and persist */
  toggle(flag: keyof FeatureFlags): boolean {
    this.flags[flag] = !this.flags[flag];
    this.persist();
    return this.flags[flag];
  }

  /** Set a flag and persist */
  set(flag: keyof FeatureFlags, value: boolean): void {
    this.flags[flag] = value;
    this.persist();
  }

  /** Get all flags (read-only copy) */
  getAll(): FeatureFlags {
    return { ...this.flags };
  }

  /** Reset all to defaults */
  reset(): void {
    this.flags = { ...DEFAULTS };
    this.persist();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.flags = { ...DEFAULTS, ...parsed };
      }
    } catch {
      this.flags = { ...DEFAULTS };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.flags));
    } catch { /* quota exceeded — silent */ }
  }
}
