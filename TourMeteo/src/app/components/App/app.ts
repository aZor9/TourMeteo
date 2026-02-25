import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { WeatherService, WeatherCity } from '../../service/weather.service';
import { SearchTabComponent } from '../SearchTab/search-tab.component';
import { WeatherSheetComponent } from '../WeatherSheet/weather-sheet.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, SearchTabComponent, WeatherSheetComponent],
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
  loading = false;

  constructor(private weatherService: WeatherService, private cd: ChangeDetectorRef) {}

  // Mise à jour des filtres en temps réel (depuis SearchTab)
  onFilterChange(filters: { showTemp: boolean; showWind: boolean; showSummary: boolean }) {
    this.showTemp = filters.showTemp;
    this.showWind = filters.showWind;
    this.showSummary = filters.showSummary;
    this.cd.detectChanges();
  }

  // Recherche météo pour les villes (séquentiel, simple)
  async search(params: { cities: string; date: string; showTemp: boolean; showWind: boolean; showSummary: boolean }) {
    const { cities, date, showTemp, showWind, showSummary } = params;
    this.showTemp = showTemp;
    this.showWind = showWind;
    this.showSummary = showSummary;
    this.selectedDate = date;
    this.loading = true;
    this.meteo = [];
    this.cd.detectChanges();

    const cityList = cities.split(',').map(c => c.trim()).filter(c => !!c);
    if (cityList.length === 0) {
      this.loading = false;
      this.cd.detectChanges();
      return;
    }

    for (const city of cityList) {
      try {
        const data = await this.weatherService.getWeather(city, date);
        data.hourly = data.hourly.map(h => ({
          ...h,
          hour: h.hour.split('T')[1]?.slice(0,2) || h.hour
        }));
        this.meteo.push(data);
      } catch (err) {
        this.meteo.push({ city, hourly: [] });
      }
      this.cd.detectChanges();
    }

    this.loading = false;
    this.cd.detectChanges();
  }
}
