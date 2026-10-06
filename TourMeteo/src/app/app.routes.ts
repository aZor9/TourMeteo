import { Routes } from '@angular/router';
import { HomeComponent } from './components/Home/home.component';
import { featureFlagGuard } from './guards/feature-flag.guard';

export const routes: Routes = [
	{ path: '', component: HomeComponent },
	{ path: 'daily', loadComponent: () => import('./components/App/app').then(m => m.App) },
	{ path: 'about', loadComponent: () => import('./components/About/about').then(m => m.AboutComponent) },
	{ path: 'gpx', loadComponent: () => import('./components/GPXUploader/gpx-uploader.component').then(m => m.GpxUploaderComponent) },
	{ path: 'run', loadComponent: () => import('./components/Running/running.component').then(m => m.RunningComponent) },
	{ path: 'route-creator', loadComponent: () => import('./components/RouteCreator/route-creator.component').then(m => m.RouteCreatorComponent) },
	{ path: 'best-departure', loadComponent: () => import('./components/BestDeparture/best-departure.component').then(m => m.BestDepartureComponent) },
	{ path: 'legal', loadComponent: () => import('./components/Legal/legal.component').then(m => m.LegalComponent) },
	{
		path: 'hourly',
		canActivate: [featureFlagGuard('hourly')],
		loadComponent: () => import('./components/Hourly/hourly.component').then(m => m.HourlyComponent)
	},
	{ path: '**', redirectTo: '' },
];
