import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { CityService } from './city.service';

export interface WeatherCity {
  city: string;
  hourly: Array<{ hour: string; temperature: number; wind: number; summary: string }>;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private weatherApiUrl = 'https://api.open-meteo.com/v1/forecast';

  constructor(private http: HttpClient, private cityService: CityService) {}

  getWeather(city: string, date: string): Observable<WeatherCity> {
    return this.cityService.getLatLon(city).pipe(
      switchMap(({ lat, lon }) =>
        this.http
          .get<any>(
            `${this.weatherApiUrl}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,weathercode&start_date=${date}&end_date=${date}`
          )
          .pipe(
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
