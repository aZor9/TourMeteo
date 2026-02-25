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

/** Clothing item recommendation */
export interface ClothingItem {
  emoji: string;
  label: string;
}

/** Ride score data emitted by RideScoreComponent */
export interface RideScoreData {
  score: number;
  label: string;
  emoji: string;
  clothingItems: ClothingItem[];
  warnings: string[];
  tips: string[];
  avgTemp: number;
  avgApparentTemp: number;
  avgWind: number;
  avgHumidity: number;
  maxPrecipProb: number;
  totalPrecip: number;
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
