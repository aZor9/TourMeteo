# TourMeteo

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## GPX import and PNG export

This app includes an "Import GPX" page where you can upload a .gpx track. The app:

- Parses the GPX track and computes total distance.
- Lets you enter an average speed and departure time to estimate passage times.
- Performs reverse-geocoding to find nearby cities (sampling by distance and throttling requests to avoid rate limits).
- Fetches hourly weather for each passage and displays an emoji/description, temperature and wind.

You can export the results as a PNG image or share them via the Web Share API on supported browsers.

Notes:

- The app performs client-side reverse-geocoding using Nominatim (OpenStreetMap). Nominatim enforces rate limits and CORS — for robust production usage consider routing requests through a small server-side proxy with caching and a proper User-Agent header.
- Export is implemented client-side (no extra dependency) and produces a simple PNG summary of passages.
