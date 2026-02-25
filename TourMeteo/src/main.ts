import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RootComponent } from './app/root.component';
import { NavbarComponent } from './app/components/navbar/navbar.component';

bootstrapApplication(RootComponent, appConfig)
  .catch((err) => console.error(err));

// Also bootstrap the navbar into the static <app-navbar> element in index.html
bootstrapApplication(NavbarComponent, appConfig).catch((err) => console.error('Navbar bootstrap error', err));
