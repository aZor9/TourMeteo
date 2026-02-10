import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CityService {
  private geocodeApiUrl = 'https://nominatim.openstreetmap.org/search';

  constructor(private http: HttpClient) {}

  getLatLon(city: string): Observable<{ lat: string; lon: string }> {
    return this.http
      .get<any[]>(`${this.geocodeApiUrl}?q=${encodeURIComponent(city)}&format=json&limit=1`)
      .pipe(
        map(results => {
          if (results.length > 0) {
            return { lat: results[0].lat, lon: results[0].lon };
          }
          throw new Error('Ville non trouvée');
        })
      );
  }
}
