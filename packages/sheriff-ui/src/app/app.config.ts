import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { appRoutes } from './app.routes';
import { EnvironmentService } from './core/environment.service';
import { provideApiConfiguration } from './api/api-configuration';

function isVsCodeWebview(): boolean {
  return typeof globalThis.__SHERIFF_API_BASE__ !== 'undefined';
}

function getApiBase(): string {
  return globalThis.__SHERIFF_API_BASE__ ?? '';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, ...(isVsCodeWebview() ? [withHashLocation()] : [])),
    provideHttpClient(withFetch()),
    EnvironmentService,
    provideApiConfiguration(getApiBase()),
  ],
};

