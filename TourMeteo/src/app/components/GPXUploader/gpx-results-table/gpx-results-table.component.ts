import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Passage } from '../../../models/passage.model';
import { getWeatherDescription, degreesToCardinal } from '../../../utils/weather-utils';

@Component({
  selector: 'app-gpx-results-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gpx-results-table.component.html'
})
export class GpxResultsTableComponent {
  @Input() passages: Passage[] = [];

  getWeatherDescription = getWeatherDescription;
  degreesToCardinal = degreesToCardinal;
}
