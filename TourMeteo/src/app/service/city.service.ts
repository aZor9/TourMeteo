import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CityService {
  // URL pour transformer un nom de ville en latitude/longitude
  private geocodeApiUrl = 'https://nominatim.openstreetmap.org/search';
  private appId = 'MeteoRide/2.2.0 (https://meteo-ride.vercel.app)';

  constructor(private http: HttpClient) {}

  // Renvoie les coordonnées (lat, lon) pour une ville (Promise)
  getLatLon(city: string): Promise<{ lat: string; lon: string }> {
    const url = `${this.geocodeApiUrl}?q=${encodeURIComponent(city)}&format=json&limit=1&email=hugo.lembrez@gmail.com`;
    return firstValueFrom(
      this.http.get<any[]>(url, { headers: { 'User-Agent': this.appId } })
    ).then(results => {
      if (results && results.length > 0) {
        return { lat: results[0].lat, lon: results[0].lon };
      }
      throw new Error('Ville non trouvée');
    });
  }
}
