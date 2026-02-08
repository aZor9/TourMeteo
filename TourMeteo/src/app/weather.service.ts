import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';

export interface WeatherCity {
  city: string;
  hourly: Array<{ hour: string; temperature: number; wind: number; summary: string }>;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private weatherApiUrl = 'https://api.open-meteo.com/v1/forecast';
  private geocodeApiUrl = 'https://nominatim.openstreetmap.org/search';

  constructor(private http: HttpClient) {}

  getLatLon(city: string): Observable<{ lat: string; lon: string }> {
    return this.http.get<any[]>(`${this.geocodeApiUrl}?q=${encodeURIComponent(city)}&format=json&limit=1`).pipe(
      map(results => {
        if (results.length > 0) {
          return { lat: results[0].lat, lon: results[0].lon };
        }
        throw new Error('Ville non trouvée');
      })
    );
  }

  getWeather(city: string, date: string): Observable<WeatherCity> {
    return this.getLatLon(city).pipe(
      switchMap(({ lat, lon }) =>
        this.http.get<any>(
          `${this.weatherApiUrl}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,weathercode&start_date=${date}&end_date=${date}`
        ).pipe(
          map(response => ({
            city,
            hourly: response.hourly.time.map((hour: string, i: number) => ({
              hour,
              temperature: response.hourly.temperature_2m[i],
              wind: response.hourly.wind_speed_10m[i],
              summary: response.hourly.weathercode[i]
            }))
          }))
        )
      )
    );
  }
}
