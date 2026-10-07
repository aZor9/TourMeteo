import { Injectable } from '@angular/core';

export interface GpxSharedState {
  points: Array<{ lat: number; lon: number }>;
  fileName: string;
  distanceKm: number;
}

/**
 * Lightweight in-memory service that passes GPX data between the
 * GpxUploaderComponent and the BestDepartureComponent so the user doesn't
 * have to re-upload the same file when switching pages.
 */
@Injectable({ providedIn: 'root' })
export class GpxStateService {
  private _state: GpxSharedState | null = null;

  set(state: GpxSharedState): void { this._state = { ...state }; }
  get(): GpxSharedState | null { return this._state; }
  clear(): void { this._state = null; }
  has(): boolean { return !!this._state && this._state.points.length > 1; }
}
