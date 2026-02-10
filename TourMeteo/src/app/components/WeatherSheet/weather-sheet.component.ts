import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeatherCity } from '../../service/weather.service';

@Component({
  selector: 'app-weather-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weather-sheet.component.html',
  styleUrls: ['./weather-sheet.component.scss']
})
export class WeatherSheetComponent {
  @Input() meteo: WeatherCity[] = [];
  @Input() showTemp = true;
  @Input() showWind = true;
  @Input() showSummary = true;
  @Input() selectedDate?: string;

  getWeatherDescription(code: number): { emoji: string, desc: string } {
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
}
