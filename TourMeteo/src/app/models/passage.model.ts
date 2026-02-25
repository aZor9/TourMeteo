/** Weather data for a single passage point */
export interface PassageWeather {
  temperature?: number;
  code?: number;
  wind?: number;
  windDir?: number;
  isDay?: boolean;
  precipitation?: number;
  precipitationProbability?: number;
  humidity?: number;
  apparentTemperature?: number;
}

/** A single passage point along the GPX route */
export interface Passage {
  city: string;
  lat: number;
  lon: number;
  time: Date;
  distanceKm: number;
  status: 'pending' | 'ok' | 'error';
  message?: string;
  weather?: PassageWeather;
}
