import { Routes } from '@angular/router';
import { AboutComponent } from './components/About/about';
import { App } from './components/App/app';
import { GpxUploaderComponent } from './components/GPXUploader/gpx-uploader.component';
import { RunningComponent } from './components/Running/running.component';
import { RouteCreatorComponent } from './components/RouteCreator/route-creator.component';
import { BestDepartureComponent } from './components/BestDeparture/best-departure.component';

export const routes: Routes = [
	{ path: '', component: App },
	{ path: 'about', component: AboutComponent },
	{ path: 'gpx', component: GpxUploaderComponent },
	{ path: 'run', component: RunningComponent },
	{ path: 'route-creator', component: RouteCreatorComponent },
	{ path: 'best-departure', component: BestDepartureComponent },
];
