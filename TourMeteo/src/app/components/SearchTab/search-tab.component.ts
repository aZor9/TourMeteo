import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  @Output() searchRequest = new EventEmitter<{
    cities: string;
    date: string;
    showTemp: boolean;
    showWind: boolean;
    showSummary: boolean;
  }>();

  submit() {
    this.searchRequest.emit({
      cities: this.cities,
      date: this.date,
      showTemp: this.showTemp,
      showWind: this.showWind,
      showSummary: this.showSummary
    });
  }
}
