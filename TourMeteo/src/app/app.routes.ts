import { Routes } from '@angular/router';
import { AboutComponent } from './components/About/about';
import { App } from './components/App/app';
import { GpxUploaderComponent } from './components/GPXUploader/gpx-uploader.component';

export const routes: Routes = [
	{ path: '', component: App },
	{ path: 'about', component: AboutComponent },
	{ path: 'gpx', component: GpxUploaderComponent },
];
