import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeatherCity } from '../../service/weather.service';
import { getWeatherDescription } from '../../utils/weather-utils';

@Component({
  selector: 'app-weather-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weather-sheet.component.html'
})
export class WeatherSheetComponent {
  @Input() meteo: WeatherCity[] = [];
  @Input() showTemp = true;
  @Input() showWind = true;
  @Input() showSummary = true;
  @Input() selectedDate?: string;

  getWeatherDescription = getWeatherDescription;
}
