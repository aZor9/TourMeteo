import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './legal.component.html'
})
export class LegalComponent {
  readonly year = new Date().getFullYear();
}
