import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecentCitiesService } from '../../service/recent-cities.service';

@Component({
  selector: 'app-search-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-tab.component.html'
})
export class SearchTabComponent {
  cities = '';
  date = new Date().toISOString().slice(0, 10);
  showTemp = true;
  showWind = true;
  showSummary = true;
  citySuggestions: string[] = [];
  showSuggestions = false;

  constructor(private recentCities: RecentCitiesService) {}

  @Output() searchRequest = new EventEmitter<{
    cities: string;
    date: string;
    showTemp: boolean;
    showWind: boolean;
    showSummary: boolean;
  }>();

  @Output() filterChange = new EventEmitter<{
    showTemp: boolean;
    showWind: boolean;
    showSummary: boolean;
  }>();

  toggleTemp() {
    this.showTemp = !this.showTemp;
    this.emitFilter();
  }

  toggleWind() {
    this.showWind = !this.showWind;
    this.emitFilter();
  }

  toggleSummary() {
    this.showSummary = !this.showSummary;
    this.emitFilter();
  }

  private emitFilter() {
    this.filterChange.emit({ showTemp: this.showTemp, showWind: this.showWind, showSummary: this.showSummary });
  }

  submit() {
    this.recentCities.addMultiple(this.cities);
    this.showSuggestions = false;
    this.searchRequest.emit({
      cities: this.cities,
      date: this.date,
      showTemp: this.showTemp,
      showWind: this.showWind,
      showSummary: this.showSummary
    });
  }

  onCityInput() {
    // Get the last city being typed (after the last comma)
    const parts = this.cities.split(',');
    const current = parts[parts.length - 1].trim();
    this.citySuggestions = this.recentCities.search(current);
    this.showSuggestions = this.citySuggestions.length > 0;
  }

  onCityFocus() {
    this.citySuggestions = this.recentCities.getAll();
    this.showSuggestions = this.citySuggestions.length > 0;
  }

  onCityBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => this.showSuggestions = false, 200);
  }

  pickSuggestion(city: string) {
    // Replace the last typed part with the picked city
    const parts = this.cities.split(',').map(s => s.trim());
    parts[parts.length - 1] = city;
    this.cities = parts.join(', ');
    this.showSuggestions = false;
  }
}
