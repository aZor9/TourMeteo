import { Routes } from '@angular/router';
import { AboutComponent } from './components/About/about';
import { App } from './components/App/app';

export const routes: Routes = [
	{ path: '', component: App },
	{ path: 'about', component: AboutComponent },
];
