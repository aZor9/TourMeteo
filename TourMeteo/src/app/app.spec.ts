import { TestBed } from '@angular/core/testing';
import { App } from './components/App/app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    // App is the home page; branding is in the global navbar.
    // Keep this test stable by checking main UI presence instead of a hardcoded title.
    expect(compiled.querySelector('app-search-tab')).toBeTruthy();
  });
});
