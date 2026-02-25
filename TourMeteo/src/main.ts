import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RootComponent } from './app/root.component';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

registerLocaleData(localeFr);

inject();
injectSpeedInsights();

bootstrapApplication(RootComponent, appConfig)
  .catch((err) => console.error(err));
