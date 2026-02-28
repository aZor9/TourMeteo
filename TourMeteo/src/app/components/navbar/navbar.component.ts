import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FeatureFlagService } from '../../service/feature-flag.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent {
  mobileMenuOpen = false;

  constructor(private ff: FeatureFlagService) {}

  get showRunning(): boolean { return this.ff.isEnabled('running'); }
  get showRouteCreator(): boolean { return this.ff.isEnabled('routeCreator'); }
  get showBestDeparture(): boolean { return this.ff.isEnabled('bestDeparture'); }
}
