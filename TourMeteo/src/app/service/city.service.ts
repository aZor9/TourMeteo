import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class CityService {
  // URL pour transformer un nom de ville en latitude/longitude
  private geocodeApiUrl = 'https://nominatim.openstreetmap.org/search';

  constructor(private http: HttpClient) {}

  // Renvoie les coordonnées (lat, lon) pour une ville (Promise)
  getLatLon(city: string): Promise<{ lat: string; lon: string }> {
    const url = `${this.geocodeApiUrl}?q=${encodeURIComponent(city)}&format=json&limit=1`;
    return new Promise((resolve, reject) => {
      this.http.get<any[]>(url).subscribe({
        next: results => {
          if (results && results.length > 0) {
            resolve({ lat: results[0].lat, lon: results[0].lon });
          } else {
            reject(new Error('Ville non trouvée'));
          }
        },
        error: err => reject(err)
      });
    });
  }
}
