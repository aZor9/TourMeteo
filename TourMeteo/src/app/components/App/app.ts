import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { WeatherService, WeatherCity } from '../../service/weather.service';
import { SearchTabComponent } from '../SearchTab/search-tab.component';
import { WeatherSheetComponent } from '../WeatherSheet/weather-sheet.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterOutlet, SearchTabComponent, WeatherSheetComponent],
  templateUrl: './app.html',
  providers: [WeatherService]
})
export class App {
  meteo: WeatherCity[] = [];
  showTemp = true;
  showWind = true;
  showSummary = true;
  selectedDate = '';
  today = new Date().toISOString().slice(0, 10);

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

  loading = false;

  constructor(private weatherService: WeatherService, private cdr: ChangeDetectorRef) {}
  search(params: { cities: string; date: string; showTemp: boolean; showWind: boolean; showSummary: boolean }) {
    const { cities, date, showTemp, showWind, showSummary } = params;
    this.showTemp = showTemp;
    this.showWind = showWind;
    this.showSummary = showSummary;
    this.meteo = [];
    this.selectedDate = date;
    this.loading = true;
    const cityList = cities.split(',').map(c => c.trim()).filter(c => !!c);
    let count = 0;
    if (cityList.length === 0) {
      this.loading = false;
      return;
    }
    for (const city of cityList) {
      this.weatherService.getWeather(city, date).subscribe({
        next: data => {
          data.hourly = data.hourly.map(h => ({
            ...h,
            hour: h.hour.split('T')[1]?.slice(0,2) || h.hour
          }));
          this.meteo.push(data);
          count++;
          if (count === cityList.length) {
            this.loading = false;
            this.cdr.detectChanges();
          }
        },
        error: () => {
          count++;
          if (count === cityList.length) {
            this.loading = false;
            this.cdr.detectChanges();
          }
        }
      });
    }
  }
}
