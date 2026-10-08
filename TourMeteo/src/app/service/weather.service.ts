import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CityService } from './city.service';

export interface WeatherCity {
  city: string;
  hourly: Array<{ hour: string; temperature: number; wind: number; windDir?: number; summary: number; isDay: boolean; precipitation?: number; precipitationProbability?: number; humidity?: number; apparentTemperature?: number }>;
}

/** Une heure de prévision détaillée (page graphiques) */
export interface DayHour {
  time: string;            // ISO local "2026-10-06T14:00"
  hour: number;            // 0-23
  temperature: number;
  apparent: number;
  dewPoint: number | null;
  precipitation: number;   // mm
  probability: number | null; // % (null si le modèle ne la fournit pas)
  weathercode: number;
  isDay: boolean;
  wind: number;            // km/h
  gust: number | null;     // km/h
  windDir: number | null;
  humidity: number | null;
  cloud: number | null;    // %
  uv: number | null;
  visibilityKm: number | null;
  pressure: number | null; // hPa
}

/** Modèles de prévision proposés par Open-Meteo (paramètre `models`) */
export interface WeatherModel { id: string; label: string; }
export const WEATHER_MODELS: WeatherModel[] = [
  { id: 'best_match', label: 'Auto' },
  { id: 'meteofrance_seamless', label: 'Météo-France' },
  { id: 'icon_seamless', label: 'ICON (DWD)' },
  { id: 'ecmwf_ifs025', label: 'ECMWF' },
  { id: 'gfs_seamless', label: 'GFS (NOAA)' }
];
export const DEFAULT_MODELS = ['best_match'];

export interface DayDetails {
  hours: DayHour[];
  /** Série horaire de chaque modèle demandé (absent si le choix automatique est utilisé) */
  byModel?: Record<string, DayHour[]>;
  sunrise: string | null;
  sunset: string | null;
  uvMax: number | null;
  sunshineH: number | null;
  daylightH: number | null;
}

export interface AirQuality {
  aqi: Array<number | null>;
  pm25: Array<number | null>;
  pm10: Array<number | null>;
  pollen: Record<string, Array<number | null>>;
}

export interface NowWeather {
  temperature: number;
  apparent: number;
  weathercode: number;
  isDay: boolean;
  wind: number;
  gust: number | null;
  humidity: number | null;
  precipitation: number;
  next: Array<{ hour: number; temperature: number; precipitation: number; probability: number; weathercode: number; isDay: boolean }>;
}

const POLLENS: Record<string, string> = {
  alder_pollen: 'Aulne', birch_pollen: 'Bouleau', grass_pollen: 'Graminées',
  olive_pollen: 'Olivier', ragweed_pollen: 'Ambroisie', mugwort_pollen: 'Armoise'
};

const nz = <T>(arr: T[] | undefined, i: number): T | null => (arr && arr[i] !== undefined && arr[i] !== null ? arr[i] : null);

@Injectable({ providedIn: 'root' })
export class WeatherService {
  // URL de l'API météo
  private weatherApiUrl = 'https://api.open-meteo.com/v1/forecast';
  private airApiUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality';

  constructor(private http: HttpClient, private cityService: CityService) {}

  // Renvoie les données météo pour une ville et une date (Promise)
  async getWeather(city: string, date: string): Promise<WeatherCity> {
    // obtenir latitude/longitude (CityService retourne maintenant une Promise)
    const { lat, lon } = await this.cityService.getLatLon(city);
    return this.getWeatherByCoords(+lat, +lon, city, date);
  }

  // Renvoie les données météo directement par coordonnées (évite le géocodage)
  async getWeatherByCoords(lat: number, lon: number, cityName: string, date: string): Promise<WeatherCity> {
    // timezone=auto : heures locales du lieu (sans ça Open-Meteo répond en GMT, donc décalé de 1-2 h en France)
    const url = `${this.weatherApiUrl}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m,winddirection_10m,weathercode,is_day,precipitation,precipitation_probability,relative_humidity_2m,apparent_temperature&start_date=${date}&end_date=${date}&timezone=auto`;

    const response: any = await firstValueFrom(this.http.get<any>(url));

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

    return { city: cityName, hourly };
  }

  /** Prévision détaillée d'une journée : rafales, UV, nuages, pression, soleil… */
  async getDayDetails(lat: number, lon: number, date: string, models: string[] = DEFAULT_MODELS): Promise<DayDetails> {
    const hourly = 'temperature_2m,apparent_temperature,dew_point_2m,precipitation,precipitation_probability,weathercode,is_day,wind_speed_10m,wind_gusts_10m,winddirection_10m,relative_humidity_2m,cloud_cover,uv_index,visibility,pressure_msl';
    const daily = 'sunrise,sunset,uv_index_max,sunshine_duration,daylight_duration';
    // Sans `models`, Open-Meteo choisit lui-même le meilleur modèle (réponse historique, clés non suffixées)
    const known = models.filter(m => WEATHER_MODELS.some(w => w.id === m));
    const useModels = known.length > 0 && !(known.length === 1 && known[0] === 'best_match');
    const url = `${this.weatherApiUrl}?latitude=${lat}&longitude=${lon}&hourly=${hourly}&daily=${daily}&start_date=${date}&end_date=${date}&timezone=auto${useModels ? `&models=${known.join(',')}` : ''}`;
    const r: any = await firstValueFrom(this.http.get<any>(url));

    // Plusieurs modèles : une série par modèle (clés suffixées `_<modèle>`) ; le premier sert de référence
    const byModel: Record<string, DayHour[]> | undefined = useModels
      ? Object.fromEntries(known.map(m => [m, this.parseHours(r.hourly, m)]))
      : undefined;
    const primary = useModels ? known[0] : '';
    const hours = byModel ? byModel[primary] : this.parseHours(r.hourly, '');

    const d = r.daily || {};
    const dc = (key: string): any[] | undefined => (primary ? d[`${key}_${primary}`] : undefined) ?? d[key];
    return {
      hours,
      byModel,
      sunrise: dc('sunrise')?.[0] ?? null,
      sunset: dc('sunset')?.[0] ?? null,
      uvMax: nz(dc('uv_index_max'), 0),
      sunshineH: dc('sunshine_duration')?.[0] != null ? +(dc('sunshine_duration')![0] / 3600).toFixed(1) : null,
      daylightH: dc('daylight_duration')?.[0] != null ? +(dc('daylight_duration')![0] / 3600).toFixed(1) : null
    };
  }

  /** Lit les colonnes horaires d'un modèle (`model` vide = réponse non suffixée) */
  private parseHours(h: any, model: string): DayHour[] {
    const c = (key: string): any[] | undefined => (model ? h[`${key}_${model}`] : undefined) ?? h[key];
    const temp = c('temperature_2m'), app = c('apparent_temperature'), vis = c('visibility');
    return h.time.map((time: string, i: number): DayHour => ({
      time,
      hour: +time.slice(11, 13),
      temperature: nz(temp, i) as number,
      apparent: (nz(app, i) ?? nz(temp, i)) as number,
      dewPoint: nz(c('dew_point_2m'), i),
      precipitation: c('precipitation')?.[i] ?? 0,
      // null = le modèle ne fournit pas de probabilité (ex. Météo-France)
      probability: nz(c('precipitation_probability'), i),
      weathercode: c('weathercode')?.[i] ?? 0,
      isDay: c('is_day')?.[i] === 1,
      wind: nz(c('wind_speed_10m'), i) as number,
      gust: nz(c('wind_gusts_10m'), i),
      windDir: nz(c('winddirection_10m'), i),
      humidity: nz(c('relative_humidity_2m'), i),
      cloud: nz(c('cloud_cover'), i),
      uv: nz(c('uv_index'), i),
      visibilityKm: vis?.[i] != null ? +(vis[i] / 1000).toFixed(1) : null,
      pressure: nz(c('pressure_msl'), i)
    }));
  }

  /** Qualité de l'air + pollens (pollens : Europe uniquement). Renvoie null si indisponible. */
  async getAirQuality(lat: number, lon: number, date: string): Promise<AirQuality | null> {
    try {
      const pollenKeys = Object.keys(POLLENS).join(',');
      const url = `${this.airApiUrl}?latitude=${lat}&longitude=${lon}&hourly=european_aqi,pm10,pm2_5,${pollenKeys}&start_date=${date}&end_date=${date}&timezone=auto`;
      const r: any = await firstValueFrom(this.http.get<any>(url));
      const h = r.hourly;
      const n = h.time.length;
      const col = (key: string) => Array.from({ length: n }, (_, i) => nz<number>(h[key], i));
      const pollen: Record<string, Array<number | null>> = {};
      for (const [key, label] of Object.entries(POLLENS)) {
        const values = col(key);
        if (values.some(v => v !== null)) pollen[label] = values;
      }
      return { aqi: col('european_aqi'), pm25: col('pm2_5'), pm10: col('pm10'), pollen };
    } catch {
      return null;
    }
  }

  /** Météo actuelle + 12 prochaines heures (page d'accueil) */
  async getNow(lat: number, lon: number): Promise<NowWeather> {
    const url = `${this.weatherApiUrl}?latitude=${lat}&longitude=${lon}`
      + `&current=temperature_2m,apparent_temperature,weathercode,is_day,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,precipitation`
      + `&hourly=temperature_2m,precipitation,precipitation_probability,weathercode,is_day&forecast_days=2&timezone=auto`;
    const r: any = await firstValueFrom(this.http.get<any>(url));
    const c = r.current;
    const h = r.hourly;
    // index de l'heure courante dans le tableau horaire
    const start = Math.max(0, h.time.findIndex((t: string) => t >= String(c.time).slice(0, 13)));
    const next = [];
    for (let i = start; i < Math.min(start + 12, h.time.length); i++) {
      next.push({
        hour: +h.time[i].slice(11, 13),
        temperature: h.temperature_2m[i],
        precipitation: h.precipitation?.[i] ?? 0,
        probability: h.precipitation_probability?.[i] ?? 0,
        weathercode: h.weathercode[i],
        isDay: h.is_day?.[i] === 1
      });
    }
    return {
      temperature: c.temperature_2m,
      apparent: c.apparent_temperature,
      weathercode: c.weathercode,
      isDay: c.is_day === 1,
      wind: c.wind_speed_10m,
      gust: nz([c.wind_gusts_10m], 0),
      humidity: nz([c.relative_humidity_2m], 0),
      precipitation: c.precipitation ?? 0,
      next
    };
  }
}
