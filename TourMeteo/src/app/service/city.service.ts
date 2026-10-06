import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CityService {
  // URL pour transformer un nom de ville en latitude/longitude
  private geocodeApiUrl = 'https://nominatim.openstreetmap.org/search';
  private appId = 'MeteoRide/2.2.0 (https://meteo-ride.vercel.app)';
  /** Cache mémoire : évite de re-solliciter Nominatim (1 req/s max) pour une ville déjà vue */
  private cache = new Map<string, { lat: string; lon: string }>();

  constructor(private http: HttpClient) {}

  // Renvoie les coordonnées (lat, lon) pour une ville (Promise)
  getLatLon(city: string): Promise<{ lat: string; lon: string }> {
    const key = city.trim().toLowerCase();
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);

    const url = `${this.geocodeApiUrl}?q=${encodeURIComponent(city)}&format=json&limit=1&email=hugo.lembrez@gmail.com`;
    return firstValueFrom(
      this.http.get<any[]>(url, { headers: { 'User-Agent': this.appId } })
    ).then(results => {
      if (results && results.length > 0) {
        const value = { lat: results[0].lat, lon: results[0].lon };
        this.cache.set(key, value);
        return value;
      }
      throw new Error('Ville non trouvée');
    });
  }
}
