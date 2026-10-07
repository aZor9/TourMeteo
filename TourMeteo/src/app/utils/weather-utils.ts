/**
 * Shared weather utility functions used across multiple components.
 * Eliminates duplication of getWeatherDescription() and degreesToCardinal().
 */

export interface WeatherDescription {
  emoji: string;
  desc: string;
}

/** Map Open-Meteo weathercode to emoji + French description */
export function getWeatherDescription(code: number | undefined | null): WeatherDescription {
  if (code === undefined || code === null) return { emoji: '❓', desc: 'Inconnu' };
  if (code === 0) return { emoji: '☀️', desc: 'Ciel clair' };
  if (code === 1 || code === 2) return { emoji: '🌤️', desc: 'Partiellement nuageux' };
  if (code === 3) return { emoji: '☁️', desc: 'Couvert' };
  if (code === 45 || code === 48) return { emoji: '🌫️', desc: 'Brouillard' };
  if (code === 51 || code === 53 || code === 55) return { emoji: '🌦️', desc: 'Bruine' };
  if (code === 56 || code === 57) return { emoji: '🌧️', desc: 'Bruine verglaçante' };
  if (code === 61 || code === 63 || code === 65) return { emoji: '🌧️', desc: 'Pluie' };
  if (code === 66 || code === 67) return { emoji: '🌧️❄️', desc: 'Pluie verglaçante' };
  if (code === 71 || code === 73 || code === 75) return { emoji: '❄️', desc: 'Neige' };
  if (code === 77) return { emoji: '❄️', desc: 'Grains de neige' };
  if (code === 80 || code === 81 || code === 82) return { emoji: '🌦️', desc: 'Averses' };
  if (code === 85 || code === 86) return { emoji: '🌨️', desc: 'Averses de neige' };
  if (code === 95) return { emoji: '⛈️', desc: 'Orage' };
  if (code === 96 || code === 99) return { emoji: '⛈️', desc: 'Orage avec grêle' };
  return { emoji: '❓', desc: 'Inconnu (' + code + ')' };
}

/** Convert wind degrees to cardinal direction string (e.g. "180° S") */
export function degreesToCardinal(deg: number | undefined | null): string {
  if (deg === undefined || deg === null || isNaN(deg)) return '';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.floor(((deg % 360) / 22.5) + 0.5) % 16;
  return `${Math.round(deg)}° ${directions[idx]}`;
}
