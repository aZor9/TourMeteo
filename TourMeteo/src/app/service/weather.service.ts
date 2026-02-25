import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CityService } from './city.service';

export interface WeatherCity {
  city: string;
  hourly: Array<{ hour: string; temperature: number; wind: number; windDir?: number; summary: number; isDay: boolean; precipitation?: number; precipitationProbability?: number; humidity?: number; apparentTemperature?: number }>;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  // URL de l'API météo
  private weatherApiUrl = 'https://api.open-meteo.com/v1/forecast';

  constructor(private http: HttpClient, private cityService: CityService) {}

  // Renvoie les données météo pour une ville et une date (Promise)
  async getWeather(city: string, date: string): Promise<WeatherCity> {
    // obtenir latitude/longitude (CityService retourne maintenant une Promise)
    const { lat, lon } = await this.cityService.getLatLon(city);

    const url = `${this.weatherApiUrl}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,winddirection_10m,weathercode,is_day,precipitation,precipitation_probability,relative_humidity_2m,apparent_temperature&start_date=${date}&end_date=${date}`;

    // wrapper simple en Promise pour convertir l'Observable Http en Promise
    const response: any = await new Promise((resolve, reject) => {
      this.http.get<any>(url).subscribe({ next: res => resolve(res), error: err => reject(err) });
    });

    // transformer la réponse brute en objet typé WeatherCity
    const hourly = response.hourly.time.map((hour: string, i: number) => ({
      hour,
      temperature: response.hourly.temperature_2m[i],
      wind: response.hourly.wind_speed_10m[i],
      windDir: response.hourly.winddirection_10m ? response.hourly.winddirection_10m[i] : undefined,
      summary: response.hourly.weathercode[i],
      isDay: !!response.hourly.is_day && response.hourly.is_day[i] === 1,
      precipitation: response.hourly.precipitation ? response.hourly.precipitation[i] : undefined,
      precipitationProbability: response.hourly.precipitation_probability ? response.hourly.precipitation_probability[i] : undefined,
      humidity: response.hourly.relative_humidity_2m ? response.hourly.relative_humidity_2m[i] : undefined,
      apparentTemperature: response.hourly.apparent_temperature ? response.hourly.apparent_temperature[i] : undefined
    }));

    return { city, hourly };
  }
}
